import {
  Client,
  EmbedBuilder,
  Guild,
  GuildMember,
  TextChannel,
  VoiceChannel,
  WebhookClient,
} from 'discord.js';
import { config } from '../config/index';
import { getPrisma } from '../database/client';
import type { ActiveVoiceSession } from '../types/index';
import { discordTimestamp, formatDuration, utcTimestamp } from '../utils/format';
import { logger } from '../utils/logger';

// key: `${guildId}:${channelId}`
const sessions = new Map<string, ActiveVoiceSession>();

function sessionKey(guildId: string, channelId: string): string {
  return `${guildId}:${channelId}`;
}

// ── Ignore-list helpers ───────────────────────────────────────────────────────

function isChannelIgnored(channelId: string): boolean {
  return config.ignoredChannelIds.has(channelId);
}

function isUserIgnored(member: GuildMember): boolean {
  if (member.user.bot) return true;
  if (config.ignoredUserIds.has(member.id)) return true;
  for (const roleId of config.ignoredRoleIds) {
    if (member.roles.cache.has(roleId)) return true;
  }
  return false;
}

// ── Alert channel resolution ──────────────────────────────────────────────────

async function resolveAlertChannel(guild: Guild): Promise<TextChannel | null> {
  if (config.alertChannelId) {
    const channel = guild.channels.cache.get(config.alertChannelId);
    if (channel?.isTextBased() && channel instanceof TextChannel) return channel;
    // Try fetching if not in cache
    try {
      const fetched = await guild.channels.fetch(config.alertChannelId);
      if (fetched instanceof TextChannel) return fetched;
    } catch {
      // fall through to auto-discovery
    }
  }

  // Auto-discovery by channel name
  const names = ['security-alerts', 'alerts', 'security-log'];
  for (const name of names) {
    const found = guild.channels.cache.find(
      (c) => c.name === name && c instanceof TextChannel,
    ) as TextChannel | undefined;
    if (found) return found;
  }

  logger.warn({ guildId: guild.id }, 'No alert channel found for guild');
  return null;
}

// ── Embed builder ─────────────────────────────────────────────────────────────

function buildAlertEmbed(
  session: ActiveVoiceSession,
  guild: Guild,
  members: GuildMember[],
): EmbedBuilder {
  const durationMs = Date.now() - session.startedAt.getTime();
  const userMentions = members.map((m) => `<@${m.id}>`).join(', ');
  const alertDelayLabel = formatDuration(config.alertDelayMs);

  return new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle('🚨 SECURITY ALERT')
    .setDescription(`Users have remained in a voice channel longer than **${alertDelayLabel}**.`)
    .addFields(
      { name: '🏠 Server', value: guild.name, inline: true },
      { name: '🔊 Voice Channel', value: session.channelName, inline: true },
      { name: '👥 Users', value: userMentions || 'Unknown', inline: false },
      { name: '⏱ Duration', value: formatDuration(durationMs), inline: true },
      { name: '🕒 Session Started', value: discordTimestamp(session.startedAt), inline: true },
    )
    .setFooter({ text: `Timestamp: ${utcTimestamp()}` })
    .setTimestamp();
}

// ── External webhook forwarding ───────────────────────────────────────────────

async function forwardToWebhook(
  session: ActiveVoiceSession,
  guild: Guild,
  members: GuildMember[],
): Promise<void> {
  const embed = buildAlertEmbed(session, guild, members);

  if (config.alertWebhookUrl) {
    try {
      const webhookClient = new WebhookClient({ url: config.alertWebhookUrl });
      await webhookClient.send({ embeds: [embed] });
      webhookClient.destroy();
    } catch (err) {
      logger.error({ err }, 'Failed to send Discord webhook alert');
    }
  }

  if (config.slackWebhookUrl) {
    try {
      const durationMs = Date.now() - session.startedAt.getTime();
      const slackPayload = {
        text: `🚨 *SECURITY ALERT* — ${guild.name}`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*🚨 SECURITY ALERT*\nUsers have remained in *${session.channelName}* for ${formatDuration(durationMs)}.`,
            },
          },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*Server:*\n${guild.name}` },
              { type: 'mrkdwn', text: `*Channel:*\n${session.channelName}` },
              {
                type: 'mrkdwn',
                text: `*Users:*\n${members.map((m) => m.user.tag).join(', ')}`,
              },
              { type: 'mrkdwn', text: `*Duration:*\n${formatDuration(durationMs)}` },
            ],
          },
        ],
      };

      const res = await fetch(config.slackWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slackPayload),
      });
      if (!res.ok) throw new Error(`Slack responded with ${res.status}`);
    } catch (err) {
      logger.error({ err }, 'Failed to send Slack webhook alert');
    }
  }
}

// ── Core alert dispatch ───────────────────────────────────────────────────────

async function fireAlert(
  client: Client,
  session: ActiveVoiceSession,
  guildId: string,
): Promise<void> {
  const key = sessionKey(guildId, session.channelId);

  // Re-check the session is still in our map (could have been cleared by leave)
  const current = sessions.get(key);
  if (!current || current.alertSent) return;

  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;

  // Fetch up-to-date voice channel state
  const voiceChannel = guild.channels.cache.get(session.channelId) as VoiceChannel | undefined;
  const liveMembers = voiceChannel
    ? Array.from(voiceChannel.members.values()).filter((m) => !isUserIgnored(m))
    : [];

  if (liveMembers.length === 0) {
    // Everyone left while the timer was running
    logger.info({ guildId, channelId: session.channelId }, 'Timer fired but channel is empty — skipping alert');
    return;
  }

  current.alertSent = true;
  const durationMs = Date.now() - current.startedAt.getTime();

  logger.info(
    { guildId, channelId: session.channelId, users: liveMembers.map((m) => m.id) },
    'Firing security alert',
  );

  const alertChannel = await resolveAlertChannel(guild);
  const embed = buildAlertEmbed(current, guild, liveMembers);
  let messageId: string | undefined;

  if (alertChannel) {
    try {
      const msg = await alertChannel.send({ embeds: [embed] });
      messageId = msg.id;
    } catch (err) {
      logger.error({ err, guildId }, 'Failed to send alert message to Discord channel');
    }
  }

  await forwardToWebhook(current, guild, liveMembers);

  // Persist alert log
  try {
    const prisma = getPrisma();
    await prisma.alertLog.create({
      data: {
        guildId,
        guildName: guild.name,
        channelId: session.channelId,
        channelName: session.channelName,
        userIds: JSON.stringify(liveMembers.map((m) => m.id)),
        userNames: JSON.stringify(liveMembers.map((m) => m.user.tag)),
        durationMs,
        messageId: messageId ?? null,
      },
    });

    // Mark session alert sent in DB
    if (current.dbSessionId) {
      await prisma.voiceSession.update({
        where: { id: current.dbSessionId },
        data: { alertSent: true, alertSentAt: new Date() },
      });
    }
  } catch (err) {
    logger.error({ err }, 'Failed to persist alert log');
  }
}

// ── Session lifecycle ─────────────────────────────────────────────────────────

async function startSession(
  client: Client,
  guildId: string,
  channelId: string,
  channelName: string,
  initialUserIds: string[],
): Promise<void> {
  const key = sessionKey(guildId, channelId);
  if (sessions.has(key)) return; // already tracked

  const startedAt = new Date();

  const session: ActiveVoiceSession = {
    guildId,
    channelId,
    channelName,
    startedAt,
    userIds: new Set(initialUserIds),
    alertSent: false,
    timerId: null,
    dbSessionId: null,
  };

  sessions.set(key, session);

  logger.info({ guildId, channelId, channelName, users: initialUserIds }, 'Voice session started');

  // Persist to DB for crash recovery
  try {
    const prisma = getPrisma();
    const row = await prisma.voiceSession.upsert({
      where: { guildId_channelId: { guildId, channelId } },
      create: {
        guildId,
        channelId,
        channelName,
        startedAt,
        userIds: JSON.stringify(initialUserIds),
      },
      update: {
        channelName,
        startedAt,
        alertSent: false,
        alertSentAt: null,
        userIds: JSON.stringify(initialUserIds),
      },
    });
    session.dbSessionId = row.id;
  } catch (err) {
    logger.error({ err }, 'Failed to persist voice session');
  }

  // Schedule the alert timer
  const timerId = setTimeout(async () => {
    await fireAlert(client, session, guildId);
  }, config.alertDelayMs);

  session.timerId = timerId;
}

async function endSession(guildId: string, channelId: string): Promise<void> {
  const key = sessionKey(guildId, channelId);
  const session = sessions.get(key);
  if (!session) return;

  if (session.timerId) {
    clearTimeout(session.timerId);
    session.timerId = null;
  }

  sessions.delete(key);

  logger.info({ guildId, channelId }, 'Voice session ended');

  try {
    const prisma = getPrisma();
    await prisma.voiceSession.deleteMany({ where: { guildId, channelId } });
  } catch (err) {
    logger.error({ err }, 'Failed to remove voice session from DB');
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function handleVoiceStateUpdate(
  client: Client,
  oldChannelId: string | null,
  newChannelId: string | null,
  member: GuildMember,
): Promise<void> {
  const guildId = member.guild.id;

  if (isUserIgnored(member)) return;

  // Helper to get non-bot human members in a channel
  const humanCount = (channelId: string): number => {
    const ch = member.guild.channels.cache.get(channelId) as VoiceChannel | undefined;
    if (!ch) return 0;
    return Array.from(ch.members.values()).filter((m) => !isUserIgnored(m)).length;
  };

  // ── User left a channel ───────────────────────────────────────────────────
  if (oldChannelId && oldChannelId !== newChannelId) {
    if (!isChannelIgnored(oldChannelId)) {
      const key = sessionKey(guildId, oldChannelId);
      const session = sessions.get(key);
      if (session) {
        session.userIds.delete(member.id);

        // Update DB user list
        try {
          if (session.dbSessionId) {
            await getPrisma().voiceSession.update({
              where: { id: session.dbSessionId },
              data: { userIds: JSON.stringify(Array.from(session.userIds)) },
            });
          }
        } catch (err) {
          logger.error({ err }, 'Failed to update session user list in DB');
        }

        if (humanCount(oldChannelId) === 0) {
          await endSession(guildId, oldChannelId);
        }
      }
    }
  }

  // ── User joined a channel ─────────────────────────────────────────────────
  if (newChannelId && newChannelId !== oldChannelId) {
    if (!isChannelIgnored(newChannelId)) {
      const key = sessionKey(guildId, newChannelId);
      const existing = sessions.get(key);

      if (existing) {
        // Add user to existing session
        existing.userIds.add(member.id);
        try {
          if (existing.dbSessionId) {
            await getPrisma().voiceSession.update({
              where: { id: existing.dbSessionId },
              data: { userIds: JSON.stringify(Array.from(existing.userIds)) },
            });
          }
        } catch (err) {
          logger.error({ err }, 'Failed to update session user list in DB');
        }
        logger.debug({ guildId, channelId: newChannelId, userId: member.id }, 'User joined existing session');
      } else {
        // Start a new session — gather all current non-bot members
        const ch = member.guild.channels.cache.get(newChannelId) as VoiceChannel | undefined;
        const channelName = ch?.name ?? 'Unknown Channel';
        const existingMembers = ch
          ? Array.from(ch.members.values())
              .filter((m) => !isUserIgnored(m))
              .map((m) => m.id)
          : [member.id];

        await startSession(client, guildId, newChannelId, channelName, existingMembers);
      }
    }
  }
}

/** Recover persisted sessions on bot restart. */
export async function recoverSessions(client: Client): Promise<void> {
  try {
    const prisma = getPrisma();
    const rows = await prisma.voiceSession.findMany();

    if (rows.length === 0) return;

    logger.info({ count: rows.length }, 'Recovering persisted voice sessions');

    for (const row of rows) {
      const guild = client.guilds.cache.get(row.guildId);
      if (!guild) {
        await prisma.voiceSession.delete({ where: { id: row.id } });
        continue;
      }

      const ch = guild.channels.cache.get(row.channelId) as VoiceChannel | undefined;
      if (!ch) {
        await prisma.voiceSession.delete({ where: { id: row.id } });
        continue;
      }

      const liveHumans = Array.from(ch.members.values()).filter((m) => !isUserIgnored(m));
      if (liveHumans.length === 0) {
        await prisma.voiceSession.delete({ where: { id: row.id } });
        continue;
      }

      // Restore in-memory session
      const key = sessionKey(row.guildId, row.channelId);
      if (sessions.has(key)) continue;

      const session: ActiveVoiceSession = {
        guildId: row.guildId,
        channelId: row.channelId,
        channelName: row.channelName,
        startedAt: row.startedAt,
        userIds: new Set(liveHumans.map((m) => m.id)),
        alertSent: row.alertSent,
        timerId: null,
        dbSessionId: row.id,
      };
      sessions.set(key, session);

      if (!row.alertSent) {
        const elapsed = Date.now() - row.startedAt.getTime();
        const remaining = Math.max(0, config.alertDelayMs - elapsed);

        session.timerId = setTimeout(async () => {
          await fireAlert(client, session, row.guildId);
        }, remaining);
      }

      logger.info(
        { guildId: row.guildId, channelId: row.channelId, alertSent: row.alertSent },
        'Session recovered',
      );
    }
  } catch (err) {
    logger.error({ err }, 'Failed to recover sessions from database');
  }
}

/** Returns a snapshot of all currently active sessions (read-only). */
export function getActiveSessions(): ReadonlyMap<string, ActiveVoiceSession> {
  return sessions;
}

/** Clears all in-memory timers (called on graceful shutdown). */
export function clearAllTimers(): void {
  for (const session of sessions.values()) {
    if (session.timerId) {
      clearTimeout(session.timerId);
      session.timerId = null;
    }
  }
}
