import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../types/index';
import { getActiveSessions } from '../services/voiceMonitor';
import { formatDuration } from '../utils/format';

const startedAt = Date.now();

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Shows bot uptime, active voice sessions, and system stats'),

  async execute(interaction: ChatInputCommandInteraction) {
    const sessions = Array.from(getActiveSessions().values());
    const uptimeMs = Date.now() - startedAt;
    const memUsage = process.memoryUsage();
    const memMB = (memUsage.heapUsed / 1_048_576).toFixed(1);

    const sessionLines =
      sessions.length === 0
        ? '_No active sessions_'
        : sessions
            .map(
              (s) =>
                `• **${s.channelName}** — ${s.userIds.size} user(s), ${formatDuration(Date.now() - s.startedAt.getTime())} ${s.alertSent ? '✅ alerted' : '⏳ pending'}`,
            )
            .join('\n');

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('🤖 Security Bot Status')
      .addFields(
        { name: '⏱ Uptime', value: formatDuration(uptimeMs), inline: true },
        { name: '🏓 WS Latency', value: `${interaction.client.ws.ping}ms`, inline: true },
        { name: '💾 Memory', value: `${memMB} MB`, inline: true },
        { name: '📡 Guilds', value: `${interaction.client.guilds.cache.size}`, inline: true },
        { name: '🔊 Active Sessions', value: `${sessions.length}`, inline: true },
        { name: '​', value: '​', inline: true },
        { name: '🔊 Session Details', value: sessionLines },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

export default command;
