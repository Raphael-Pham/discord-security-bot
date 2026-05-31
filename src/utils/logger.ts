import pino from 'pino';
import { config } from '../config/index';

const transport =
  config.logPretty || config.nodeEnv === 'development'
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined;

export const logger = pino(
  {
    level: config.logLevel,
    base: { service: 'discord-security-bot' },
  },
  transport ? pino.transport(transport) : undefined,
);
