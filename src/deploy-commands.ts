/**
 * Run this script once to register (or update) slash commands with Discord.
 *
 *   npm run register-commands        — uses ts-node (local dev)
 *   npm run register-commands:prod   — uses compiled JS (post-build)
 *
 * Set DISCORD_GUILD_ID to deploy to a single guild instantly (dev).
 * Unset it to deploy globally (up to 1 hour propagation).
 */
import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { config } from './config/index';
import { logger } from './utils/logger';

import pingCommand from './commands/ping';
import configCommand from './commands/config';
import statusCommand from './commands/status';
import sessionsCommand from './commands/sessions';
import testAlertCommand from './commands/testAlert';

const commands = [
  pingCommand,
  configCommand,
  statusCommand,
  sessionsCommand,
  testAlertCommand,
].map((c) => c.data.toJSON());

const rest = new REST().setToken(config.token);

async function deploy(): Promise<void> {
  logger.info({ count: commands.length }, 'Registering slash commands…');

  if (config.guildId) {
    await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), {
      body: commands,
    });
    logger.info({ guildId: config.guildId }, 'Guild slash commands registered');
  } else {
    await rest.put(Routes.applicationCommands(config.clientId), { body: commands });
    logger.info('Global slash commands registered (may take up to 1 hour to propagate)');
  }
}

deploy().catch((err) => {
  logger.error({ err }, 'Failed to register slash commands');
  process.exit(1);
});
