import type { Interaction } from 'discord.js';
import type { BotClient, Event } from '../types/index';
import { logger } from '../utils/logger';

const event: Event<'interactionCreate'> = {
  name: 'interactionCreate',
  async execute(interaction: Interaction) {
    if (!interaction.isChatInputCommand()) return;

    const client = interaction.client as BotClient;
    const command = client.commands.get(interaction.commandName);

    if (!command) {
      logger.warn({ command: interaction.commandName }, 'Unknown command');
      await interaction.reply({ content: 'Unknown command.', ephemeral: true });
      return;
    }

    try {
      logger.info(
        { command: interaction.commandName, userId: interaction.user.id },
        'Command executed',
      );
      await command.execute(interaction);
    } catch (err) {
      logger.error({ err, command: interaction.commandName }, 'Command execution error');
      const msg = { content: 'An error occurred while executing that command.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(msg);
      } else {
        await interaction.reply(msg);
      }
    }
  },
};

export default event;
