import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

let _prisma: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!_prisma) {
    _prisma = new PrismaClient({
      log: [
        { level: 'warn', emit: 'stdout' },
        { level: 'error', emit: 'stdout' },
      ],
    });
  }
  return _prisma;
}

export async function connectDatabase(): Promise<void> {
  const prisma = getPrisma();
  await prisma.$connect();
  logger.info('Database connected');
}

export async function disconnectDatabase(): Promise<void> {
  if (_prisma) {
    await _prisma.$disconnect();
    logger.info('Database disconnected');
  }
}
