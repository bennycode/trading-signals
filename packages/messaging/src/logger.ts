import pino from 'pino';
import path from 'node:path';
import {createTelegramAlertStream, type TelegramAlertStreamOptions} from './logger/telegramAlertTransport.js';

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

/*
 * pino-roll and stdout run inside a worker thread (the `pino.transport({targets})`
 * pattern). Telegram alerts run in-process so they survive the dev/tsx → prod/built
 * boundary without the worker-thread file-path footgun.
 */
const workerTransport = pino.transport({targets});
const streams: pino.StreamEntry[] = [{level: 'debug', stream: workerTransport}];

const telegramAlertOptions = buildTelegramAlertOptions();
if (telegramAlertOptions) {
  const label = pino.levels.labels[telegramAlertOptions.level ?? 50];
  streams.push({
    level: (isPinoLevel(label) ? label : 'error') satisfies pino.Level,
    stream: createTelegramAlertStream(telegramAlertOptions),
  });
}

function isPinoLevel(value: string | undefined): value is pino.Level {
  return typeof value === 'string' && value in pino.levels.values;
}

export const logger = pino({level: 'debug'}, pino.multistream(streams));

function buildTelegramAlertOptions(): TelegramAlertStreamOptions | undefined {
  if (process.env.TELEGRAM_ALERTS_ENABLED?.trim().toLowerCase() === 'false') {
    return undefined;
  }
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!botToken) {
    return undefined;
  }
  const chatId = process.env.TELEGRAM_ALERT_CHAT_ID?.trim() || process.env.TELEGRAM_OWNER_IDS?.split(',')[0]?.trim();
  if (!chatId) {
    return undefined;
  }
  return {
    botToken,
    chatId,
    dedupMs: parsePositiveInt(process.env.TELEGRAM_ALERT_DEDUP_MS) ?? 600_000,
    level: parseLevel(process.env.TELEGRAM_ALERT_LEVEL) ?? 50,
  };
}

function parseLevel(raw: string | undefined): number | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return undefined;
  }
  const asNumber = Number(trimmed);
  if (Number.isInteger(asNumber) && asNumber > 0) {
    return asNumber;
  }
  const fromLabel = pino.levels.values[trimmed.toLowerCase()];
  return typeof fromLabel === 'number' ? fromLabel : undefined;
}

function parsePositiveInt(raw: string | undefined): number | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return undefined;
  }
  const asNumber = Number(trimmed);
  return Number.isInteger(asNumber) && asNumber > 0 ? asNumber : undefined;
}
