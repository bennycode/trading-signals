import axios from 'axios';
import axiosRetry from 'axios-retry';
import {z} from 'zod';

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

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const client = axios.create({
  baseURL: 'https://finnhub.io/api/v1',
});

axiosRetry(client, {
  retries: 3,
  retryCondition: error => axiosRetry.isNetworkError(error) || error.response?.status === 429,
  retryDelay: retryCount => retryCount * 1_000,
});

/**
 * Checks whether a symbol is reporting quarterly earnings on the given UTC date.
 *
 * @see https://finnhub.io/docs/api/earnings-calendar
 */
export async function isEarningsDay(options: {apiKey: string; date: Date; symbol: string}): Promise<boolean> {
  const isoDate = toIsoDate(options.date);
  const response = await client.get('/calendar/earnings', {
    params: {
      from: isoDate,
      symbol: options.symbol,
      to: isoDate,
      token: options.apiKey,
    },
  });
  const parsed = EarningsCalendarResponseSchema.parse(response.data);
  const entries = parsed.earningsCalendar ?? [];
  return entries.some(entry => entry.symbol === options.symbol && entry.date === isoDate);
}
