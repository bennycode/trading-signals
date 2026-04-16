import pino from 'pino';
import path from 'node:path';

const logDirectory = process.env.TYPEDTRADER_LOG_DIRECTORY?.trim() || process.env.TYPEDTRADER_DB_DIRECTORY?.trim();

const targets: pino.TransportTargetOptions[] = [
  {
    target: 'pino/file',
    options: {destination: 1},
    level: 'info',
  },
];

if (logDirectory) {
  targets.push({
    target: 'pino/file',
    options: {
      destination: path.join(logDirectory, 'typedtrader.log'),
      mkdir: true,
    },
    level: 'debug',
  });
}

export const logger = pino({
  level: 'debug',
  transport: {targets},
});
