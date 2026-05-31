import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { config } from '../config/index';
import { getActiveSessions } from './voiceMonitor';
import { logger } from '../utils/logger';

const startedAt = Date.now();

function handler(_req: IncomingMessage, res: ServerResponse): void {
  const sessions = Array.from(getActiveSessions().values()).map((s) => ({
    channelId: s.channelId,
    channelName: s.channelName,
    users: s.userIds.size,
    alertSent: s.alertSent,
    durationMs: Date.now() - s.startedAt.getTime(),
  }));

  const body = JSON.stringify({
    status: 'ok',
    uptimeMs: Date.now() - startedAt,
    activeSessions: sessions.length,
    sessions,
  });

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(body);
}

export function startHealthServer(): void {
  const server = createServer(handler);
  server.listen(config.port, () => {
    logger.info({ port: config.port }, 'Health server listening');
  });
  server.on('error', (err) => {
    logger.error({ err }, 'Health server error');
  });
}
