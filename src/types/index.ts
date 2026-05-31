import type { ChatInputCommandInteraction, Client, ClientEvents } from 'discord.js';

// ── Slash command shape ───────────────────────────────────────────────────────
export interface Command {
  data: { name: string; toJSON(): unknown };
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
}

// ── Event handler shape ───────────────────────────────────────────────────────
export interface Event<K extends keyof ClientEvents = keyof ClientEvents> {
  name: K;
  once?: boolean;
  execute(...args: ClientEvents[K]): Promise<void>;
}

// ── In-memory voice session ───────────────────────────────────────────────────
export interface ActiveVoiceSession {
  guildId: string;
  channelId: string;
  channelName: string;
  startedAt: Date;
  userIds: Set<string>;
  alertSent: boolean;
  timerId: NodeJS.Timeout | null;
  dbSessionId: string | null;
}

// ── Extended Discord client with command registry ─────────────────────────────
export interface BotClient extends Client {
  commands: Map<string, Command>;
}

// ── Configuration shape (validated from env) ──────────────────────────────────
export interface BotConfig {
  token: string;
  clientId: string;
  guildId: string | null;
  alertChannelId: string | null;
  alertDelayMs: number;
  ignoredChannelIds: Set<string>;
  ignoredRoleIds: Set<string>;
  ignoredUserIds: Set<string>;
  logLevel: string;
  logPretty: boolean;
  databaseUrl: string;
  alertWebhookUrl: string | null;
  slackWebhookUrl: string | null;
  port: number;
  nodeEnv: string;
}
