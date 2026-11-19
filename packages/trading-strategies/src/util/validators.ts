import {parse, type StringValue} from 'ms';
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

/**
 * A bar size in `ms` syntax (`"1m"`, `"5m"`, `"1d"`), no smaller than the candles a strategy
 * receives. Built on `z.string()` rather than `z.custom()` so that it still describes itself as a
 * string to `z.toJSONSchema`, which is what the docs site renders a strategy's settings from.
 */
export const timeframeString = z.string().refine((value): value is StringValue => {
  try {
    /*
     * `ms` throws on a string it cannot even attempt to read, which is a failed validation and not
     * a failed parse: a config saying `""` has to come back as invalid rather than as an exception.
     */
    const millis = parse(value);
    return Number.isFinite(millis) && millis >= ONE_MINUTE_IN_MS;
  } catch {
    return false;
  }
}, 'Must be a duration of at least "1m" in ms syntax, e.g. "1m", "5m", "1d"');
