import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../types/index';

const command: Command = {
  data: new SlashCommandBuilder().setName('ping').setDescription('Health check — returns bot latency'),

  async execute(interaction: ChatInputCommandInteraction) {
    const sent = await interaction.reply({ content: '🏓 Pinging…', fetchReply: true });
    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    const wsLatency = interaction.client.ws.ping;

    await interaction.editReply(
      `🏓 **Pong!**\nRound-trip: \`${latency}ms\`\nWebSocket: \`${wsLatency}ms\``,
    );
  },
};

export default command;
