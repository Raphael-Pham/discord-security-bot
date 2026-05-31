import type { VoiceState } from 'discord.js';
import type { Event } from '../types/index';
import { handleVoiceStateUpdate } from '../services/voiceMonitor';
import { logger } from '../utils/logger';

const event: Event<'voiceStateUpdate'> = {
  name: 'voiceStateUpdate',
  async execute(oldState: VoiceState, newState: VoiceState) {
    const member = newState.member ?? oldState.member;
    if (!member) return;

    logger.debug(
      {
        userId: member.id,
        userTag: member.user.tag,
        oldChannel: oldState.channelId,
        newChannel: newState.channelId,
      },
      'Voice state update',
    );

    try {
      await handleVoiceStateUpdate(
        newState.client,
        oldState.channelId,
        newState.channelId,
        member,
      );
    } catch (err) {
      logger.error({ err, userId: member.id }, 'Error handling voice state update');
    }
  },
};

export default event;
