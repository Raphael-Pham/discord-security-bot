import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { config } from '../config/index';
import { getActiveSessions } from './voiceMonitor';
import { logger } from '../utils/logger';
import type { BotClient } from '../types/index';

const startedAt = Date.now();

function makeHandler(client: BotClient) {
  return function handler(_req: IncomingMessage, res: ServerResponse): void {
    const sessions = Array.from(getActiveSessions().values()).map((s) => ({
      channelId: s.channelId,
      channelName: s.channelName,
      users: s.userIds.size,
      alertSent: s.alertSent,
      durationMs: Date.now() - s.startedAt.getTime(),
    }));

    const discordReady = client.isReady();

    const body = JSON.stringify({
      status: discordReady ? 'ok' : 'discord_disconnected',
      uptimeMs: Date.now() - startedAt,
      discordReady,
      activeSessions: sessions.length,
      sessions,
    });

    res.writeHead(discordReady ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(body);
  };
}

export function startHealthServer(client: BotClient): void {
  const server = createServer(makeHandler(client));
  server.listen(config.port, () => {
    logger.info({ port: config.port }, 'Health server listening');
  });
  server.on('error', (err) => {
    logger.error({ err }, 'Health server error');
  });
}
