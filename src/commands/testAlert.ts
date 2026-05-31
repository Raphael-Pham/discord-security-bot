import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
  TextChannel,
} from 'discord.js';
import type { Command } from '../types/index';
import { config } from '../config/index';
import { discordTimestamp, formatDuration } from '../utils/format';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('test-alert')
    .setDescription('Sends a fake security alert to the configured alert channel'),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild;
    if (!guild) {
      await interaction.editReply('This command must be used inside a server.');
      return;
    }

    // Find alert channel
    let alertChannel: TextChannel | null = null;

    if (config.alertChannelId) {
      const ch = guild.channels.cache.get(config.alertChannelId);
      if (ch instanceof TextChannel) alertChannel = ch;
    }

    if (!alertChannel) {
      for (const name of ['security-alerts', 'alerts', 'security-log']) {
        const found = guild.channels.cache.find(
          (c) => c.name === name && c instanceof TextChannel,
        ) as TextChannel | undefined;
        if (found) {
          alertChannel = found;
          break;
        }
      }
    }

    if (!alertChannel) {
      await interaction.editReply(
        '❌ Could not find an alert channel. Set `ALERT_CHANNEL_ID` or create a channel named `security-alerts`.',
      );
      return;
    }

    const fakeStartedAt = new Date(Date.now() - config.alertDelayMs);
    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('🚨 SECURITY ALERT *(TEST)*')
      .setDescription(
        `⚠️ **This is a test alert.** Users have remained in a voice channel longer than **${formatDuration(config.alertDelayMs)}**.`,
      )
      .addFields(
        { name: '🏠 Server', value: guild.name, inline: true },
        { name: '🔊 Voice Channel', value: 'General VC *(fake)*', inline: true },
        { name: '👥 Users', value: `<@${interaction.user.id}>`, inline: false },
        { name: '⏱ Duration', value: formatDuration(config.alertDelayMs), inline: true },
        { name: '🕒 Session Started', value: discordTimestamp(fakeStartedAt), inline: true },
      )
      .setFooter({ text: `Triggered by ${interaction.user.tag} via /test-alert` })
      .setTimestamp();

    await alertChannel.send({ embeds: [embed] });
    await interaction.editReply(`✅ Test alert sent to <#${alertChannel.id}>.`);
  },
};

export default command;
