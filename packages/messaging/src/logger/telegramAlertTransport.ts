import {Writable} from 'node:stream';
import {FingerprintDedup, type AlertLogRecord, fingerprint, formatAlertMessage} from './telegramAlertHelpers.js';

/**
 * Options accepted by the alert stream. Wired in `logger.ts` from environment variables.
 */
export type TelegramAlertStreamOptions = {
  botToken: string;
  chatId: string;
  /** Pino numeric level. Records below this are dropped silently. Default: 50 (error). */
  level?: number;
  /** Dedup window in milliseconds. Default: 600_000 (10 min). */
  dedupMs?: number;
  /**
   * Override the fetch implementation. Used by tests; production code lets it default to
   * the global `fetch` (available since Node 18 — this project targets the LTS, see
   * `.nvmrc`).
   */
  fetch?: typeof fetch;
  /**
   * Override the stderr writer. Used by tests so we can assert on the loop-safety
   * fallback path without polluting real stderr.
   */
  stderrWrite?: (chunk: string) => void;
};

const TELEGRAM_API_BASE = 'https://api.telegram.org';

/**
 * Build a pino-compatible `Writable` that posts level ≥ N log records to a single
 * Telegram chat as alerts. Wired in-process via `pino.multistream` so it works in both
 * dev (tsx → .ts) and prod (built .js) without the worker-thread file path footgun.
 *
 * Loop safety: this stream never logs via pino. If sending fails (Telegram down, rate
 * limit, malformed token), it writes a one-line warning to `process.stderr` and moves on.
 * Otherwise a Telegram outage would generate pino error logs that this same stream
 * would try to forward, multiplying the problem.
 *
 * Dedup: identical structural errors within `dedupMs` collapse to a single alert. See
 * `telegramAlertHelpers#fingerprint` for the normalisation strategy.
 */
export function createTelegramAlertStream(options: TelegramAlertStreamOptions): Writable {
  const {botToken, chatId} = options;
  const minLevel = options.level ?? 50;
  const dedup = new FingerprintDedup(options.dedupMs ?? 600_000);
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const stderrWrite = options.stderrWrite ?? ((chunk: string) => void process.stderr.write(chunk));
  const sendMessageUrl = `${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`;

  if (typeof fetchImpl !== 'function') {
    stderrWrite('[telegramAlertStream] global fetch is unavailable; alerts disabled.\n');
  }

  return new Writable({
    /*
     * pino writes each log line as a string. We parse, filter, dedup, and (best-effort)
     * forward to Telegram. Always call `callback()` so pino's backpressure works and a
     * slow Telegram round-trip doesn't stall logging.
     */
    write(chunk: unknown, _encoding, callback) {
      callback();

      const raw = typeof chunk === 'string' ? chunk : Buffer.isBuffer(chunk) ? chunk.toString('utf8') : null;
      if (raw === null) {
        return;
      }
      let record: AlertLogRecord;
      try {
        record = JSON.parse(raw) as AlertLogRecord;
      } catch {
        return;
      }

      if (typeof record.level !== 'number' || record.level < minLevel) {
        return;
      }
      if (!dedup.shouldSend(fingerprint(record))) {
        return;
      }
      if (typeof fetchImpl !== 'function') {
        return;
      }

      const text = formatAlertMessage(record);
      void sendTelegramMessage({chatId, fetchImpl, sendMessageUrl, stderrWrite, text});
    },
  });
}

async function sendTelegramMessage(params: {
  chatId: string;
  fetchImpl: typeof fetch;
  sendMessageUrl: string;
  stderrWrite: (chunk: string) => void;
  text: string;
}): Promise<void> {
  try {
    const response = await params.fetchImpl(params.sendMessageUrl, {
      body: JSON.stringify({chat_id: params.chatId, text: params.text}),
      headers: {'content-type': 'application/json'},
      method: 'POST',
    });
    if (!response.ok) {
      params.stderrWrite(`[telegramAlertStream] sendMessage failed: ${response.status} ${response.statusText}\n`);
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    params.stderrWrite(`[telegramAlertStream] sendMessage threw: ${reason}\n`);
  }
}
