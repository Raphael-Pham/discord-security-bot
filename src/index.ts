import 'dotenv/config';
import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import { config } from './config/index';
import { connectDatabase, disconnectDatabase } from './database/client';
import { startHealthServer } from './services/healthServer';
import { clearAllTimers } from './services/voiceMonitor';
import type { BotClient, Command, Event } from './types/index';
import { logger } from './utils/logger';

import pingCommand from './commands/ping';
import configCommand from './commands/config';
import statusCommand from './commands/status';
import sessionsCommand from './commands/sessions';
import testAlertCommand from './commands/testAlert';

import readyEvent from './events/ready';
import voiceStateUpdateEvent from './events/voiceStateUpdate';
import interactionCreateEvent from './events/interactionCreate';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel],
}) as BotClient;

client.commands = new Collection<string, Command>();

// ── Register commands ─────────────────────────────────────────────────────────
const commands: Command[] = [
  pingCommand,
  configCommand,
  statusCommand,
  sessionsCommand,
  testAlertCommand,
];

for (const cmd of commands) {
  client.commands.set(cmd.data.name, cmd);
}

// ── Register events ───────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const events: Event<any>[] = [readyEvent, voiceStateUpdateEvent, interactionCreateEvent];

for (const event of events) {
  const listener = (...args: unknown[]) => event.execute(...args);
  if (event.once) {
    client.once(event.name, listener);
  } else {
    client.on(event.name, listener);
  }
}

// ── Global error handling ─────────────────────────────────────────────────────
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception — shutting down');
  process.exit(1);
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutdown signal received');
  clearAllTimers();
  client.destroy();
  await disconnectDatabase();
  logger.info('Graceful shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ── Startup ───────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  logger.info('Starting Discord Security Bot…');

  await connectDatabase();
  startHealthServer();

  await client.login(config.token);
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start bot');
  process.exit(1);
});
