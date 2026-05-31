import type { Client } from 'discord.js';
import type { Event } from '../types/index';
import { recoverSessions } from '../services/voiceMonitor';
import { logger } from '../utils/logger';

const event: Event<'ready'> = {
  name: 'ready',
  once: true,
  async execute(client: Client<true>) {
    logger.info(
      { tag: client.user.tag, guilds: client.guilds.cache.size },
      'Bot is ready',
    );

    await recoverSessions(client);
  },
};

export default event;
