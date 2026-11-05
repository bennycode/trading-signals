import {z} from 'zod';

/**
 * Alpha Vantage prefixes every OHLCV field with its position, and the keys are identical across the
 * daily, weekly and monthly series.
 *
 * @see https://www.alphavantage.co/documentation/#daily
 */
export const TimeSeriesBarSchema = z.looseObject({
  '1. open': z.string(),
  '2. high': z.string(),
  '3. low': z.string(),
  '4. close': z.string(),
  '5. volume': z.string(),
});

export const TimeSeriesMapSchema = z.record(z.string(), TimeSeriesBarSchema);

/**
 * Alpha Vantage answers a rejected request with HTTP 200 and an explanatory body rather than an
 * error status, so a throttled or unauthorised call looks like a success to any HTTP client. The
 * envelope carries those three messages, and the series itself sits under a key whose name depends
 * on the function that was called ("Time Series (Daily)", "Weekly Time Series", ...), which is why
 * it is resolved separately instead of being declared here.
 *
 * @see https://www.alphavantage.co/documentation/
 */
export const TimeSeriesEnvelopeSchema = z.looseObject({
  'Error Message': z.string().optional(),
  /** Carries the rate-limit notice and the "premium feature" rejection. */
  Information: z.string().optional(),
  Note: z.string().optional(),
});

export type TimeSeriesBar = z.infer<typeof TimeSeriesBarSchema>;
export type TimeSeriesMap = z.infer<typeof TimeSeriesMapSchema>;
export type TimeSeriesEnvelope = z.infer<typeof TimeSeriesEnvelopeSchema>;
