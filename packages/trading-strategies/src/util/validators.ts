import {ms, type StringValue} from 'ms';
import {z} from 'zod';
import {ONE_MINUTE_IN_MS} from '@typedtrader/exchange';

export const positiveNumberString = z
  .string()
  .regex(/^\d+(\.\d+)?$/, 'Must be a positive number')
  .refine(val => parseFloat(val) > 0, 'Must be greater than 0');

/** Mutually exclusive buy sizing: set `quantity` (base) OR `spend` (counter), or neither for all available. */
export const BuyAmountSchema = z.union([
  z.object({quantity: positiveNumberString, spend: z.never().optional()}),
  z.object({quantity: z.never().optional(), spend: positiveNumberString}),
  z.object({quantity: z.never().optional(), spend: z.never().optional()}),
]);

/** A bar size in `ms` syntax (`"1m"`, `"5m"`, `"1d"`), no smaller than the candles a strategy receives. */
export const timeframeString = z.custom<StringValue>(value => {
  if (typeof value !== 'string') {
    return false;
  }
  const millis = ms(value as StringValue);
  return typeof millis === 'number' && Number.isFinite(millis) && millis >= ONE_MINUTE_IN_MS;
}, 'Must be a duration of at least "1m" in ms syntax, e.g. "1m", "5m", "1d"');
