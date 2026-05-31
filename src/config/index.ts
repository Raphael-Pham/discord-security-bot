import 'dotenv/config';
import type { BotConfig } from '../types/index';

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    console.error(`\n[FATAL] Missing required environment variable: ${key}`);
    console.error(`        Copy .env.example to .env and fill in the missing values.\n`);
    process.exit(1);
  }
  return value.trim();
}

function optionalEnv(key: string): string | null {
  const value = process.env[key];
  return value && value.trim() !== '' ? value.trim() : null;
}

function parseIdList(raw: string | undefined): Set<string> {
  if (!raw || raw.trim() === '') return new Set();
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

function parsePort(raw: string | undefined): number {
  const n = parseInt(raw ?? '3000', 10);
  return isNaN(n) ? 3000 : n;
}

function parseDelay(raw: string | undefined): number {
  const seconds = parseInt(raw ?? '60', 10);
  if (isNaN(seconds) || seconds < 1) {
    console.warn('[WARN] ALERT_DELAY_SECONDS is invalid; defaulting to 60 seconds.');
    return 60_000;
  }
  return seconds * 1_000;
}

export const config: BotConfig = {
  token: requireEnv('DISCORD_TOKEN'),
  clientId: requireEnv('DISCORD_CLIENT_ID'),
  guildId: optionalEnv('DISCORD_GUILD_ID'),
  alertChannelId: optionalEnv('ALERT_CHANNEL_ID'),
  alertDelayMs: parseDelay(process.env.ALERT_DELAY_SECONDS),
  ignoredChannelIds: parseIdList(process.env.IGNORED_CHANNEL_IDS),
  ignoredRoleIds: parseIdList(process.env.IGNORED_ROLE_IDS),
  ignoredUserIds: parseIdList(process.env.IGNORED_USER_IDS),
  logLevel: optionalEnv('LOG_LEVEL') ?? 'info',
  logPretty: process.env.LOG_PRETTY === 'true',
  databaseUrl: requireEnv('DATABASE_URL'),
  alertWebhookUrl: optionalEnv('ALERT_WEBHOOK_URL'),
  slackWebhookUrl: optionalEnv('SLACK_WEBHOOK_URL'),
  port: parsePort(process.env.PORT),
  nodeEnv: optionalEnv('NODE_ENV') ?? 'production',
};
