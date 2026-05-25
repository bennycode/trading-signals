import pino from 'pino';
import path from 'node:path';

const logDirectory = process.env.TYPEDTRADER_LOG_DIRECTORY?.trim() || process.env.TYPEDTRADER_DB_DIRECTORY?.trim();

const targets: pino.TransportTargetOptions[] = [
  {
    level: 'info',
    options: {destination: 1},
    target: 'pino/file',
  },
];

if (logDirectory) {
  targets.push({
    level: 'debug',
    options: {
      file: path.join(logDirectory, 'typedtrader.log'),
      limit: {count: 10},
      mkdir: true,
      size: '10m',
    },
    target: 'pino-roll',
  });
}

export const logger = pino({
  level: 'debug',
  transport: {targets},
});
