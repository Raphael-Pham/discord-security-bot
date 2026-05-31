import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../types/index';
import { config } from '../config/index';
import { formatDuration } from '../utils/format';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Displays the current bot configuration'),

  async execute(interaction: ChatInputCommandInteraction) {
    const alertChannel = config.alertChannelId
      ? `<#${config.alertChannelId}>`
      : '_Auto-discovery_';

    const ignoredChannels =
      config.ignoredChannelIds.size > 0
        ? Array.from(config.ignoredChannelIds)
            .map((id) => `<#${id}>`)
            .join(', ')
        : '_None_';

    const ignoredRoles =
      config.ignoredRoleIds.size > 0
        ? Array.from(config.ignoredRoleIds)
            .map((id) => `<@&${id}>`)
            .join(', ')
        : '_None_';

    const ignoredUsers =
      config.ignoredUserIds.size > 0
        ? Array.from(config.ignoredUserIds)
            .map((id) => `<@${id}>`)
            .join(', ')
        : '_None_';

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('⚙️ Bot Configuration')
      .addFields(
        { name: '🔔 Alert Channel', value: alertChannel, inline: true },
        { name: '⏱ Alert Delay', value: formatDuration(config.alertDelayMs), inline: true },
        { name: '🌍 Environment', value: config.nodeEnv, inline: true },
        { name: '🔇 Ignored Channels', value: ignoredChannels },
        { name: '🔇 Ignored Roles', value: ignoredRoles },
        { name: '🔇 Ignored Users', value: ignoredUsers },
        { name: '📊 Log Level', value: config.logLevel, inline: true },
        { name: '🔗 Discord Webhook', value: config.alertWebhookUrl ? '✅ Configured' : '❌ Not set', inline: true },
        { name: '🔗 Slack Webhook', value: config.slackWebhookUrl ? '✅ Configured' : '❌ Not set', inline: true },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

export default command;
