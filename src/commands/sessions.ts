import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../types/index';
import { getActiveSessions } from '../services/voiceMonitor';
import { discordTimestamp, formatDuration } from '../utils/format';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('sessions')
    .setDescription('Lists all currently active voice sessions'),

  async execute(interaction: ChatInputCommandInteraction) {
    const sessions = Array.from(getActiveSessions().values()).filter(
      (s) => s.guildId === interaction.guildId,
    );

    if (sessions.length === 0) {
      await interaction.reply({
        content: '✅ No active voice sessions at the moment.',
        ephemeral: true,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xfee75c)
      .setTitle(`🔊 Active Voice Sessions (${sessions.length})`)
      .setTimestamp();

    for (const s of sessions) {
      const duration = formatDuration(Date.now() - s.startedAt.getTime());
      const users = Array.from(s.userIds)
        .map((id) => `<@${id}>`)
        .join(', ');
      const alertStatus = s.alertSent ? '🚨 Alert sent' : '⏳ Monitoring';

      embed.addFields({
        name: `#${s.channelName}`,
        value: [
          `**Users:** ${users}`,
          `**Duration:** ${duration}`,
          `**Started:** ${discordTimestamp(s.startedAt)}`,
          `**Status:** ${alertStatus}`,
        ].join('\n'),
      });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

export default command;
