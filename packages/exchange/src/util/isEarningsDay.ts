import axios from 'axios';
import {z} from 'zod';
import {withRetry} from './retry.js';

const EarningsEntrySchema = z.looseObject({
  date: z.string(),
  hour: z.string(),
  quarter: z.number(),
  symbol: z.string(),
  year: z.number(),
});

const EarningsCalendarResponseSchema = z.looseObject({
  earningsCalendar: z.array(EarningsEntrySchema).nullable(),
});

export type EarningsEntry = z.infer<typeof EarningsEntrySchema>;

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

const client = axios.create({
  baseURL: 'https://finnhub.io/api/v1',
});

// This client skips simplifyError, so errors arrive as raw AxiosError — not SimplifiedHttpError.
function isRetryableFinnhubError(error: unknown) {
  return axios.isAxiosError(error) && (!error.response || error.response.status === 429);
}

/**
 * Checks whether a symbol is reporting quarterly earnings on the given UTC date.
 *
 * @see https://finnhub.io/docs/api/earnings-calendar
 */
export async function isEarningsDay(options: {apiKey: string; date: Date; symbol: string}) {
  const isoDate = toIsoDate(options.date);
  const response = await withRetry(
    () =>
      client.get('/calendar/earnings', {
        params: {
          from: isoDate,
          symbol: options.symbol,
          to: isoDate,
          token: options.apiKey,
        },
      }),
    {isRetryable: isRetryableFinnhubError, retries: 3}
  );
  const parsed = EarningsCalendarResponseSchema.parse(response.data);
  const entries = parsed.earningsCalendar ?? [];
  return entries.some(entry => entry.symbol === options.symbol && entry.date === isoDate);
}
