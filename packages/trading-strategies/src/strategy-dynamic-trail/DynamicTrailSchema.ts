import {z} from 'zod';
import {positiveNumberString} from '../util/validators.js';

export const DynamicTrailSchema = z.object({
  /** ATR lookback used to measure volatility. Defaults to 14. */
  atrInterval: z.number().int().positive().default(14),
  /**
   * Candle size (in milliseconds) the ATR is measured on. When set, the live 1-minute stream is
   * aggregated to this timeframe before feeding the ATR, so the trail width reflects e.g. daily
   * volatility (86400000) instead of per-minute noise. The peak and breach checks still run on
   * every candle, so exits stay intraday-responsive. Omit to measure ATR on each incoming candle.
   */
  atrIntervalMillis: z.number().int().positive().optional(),
  /**
   * ATR multiple that sets the trail width: `trailPct = atrMultiple * ATR%`. Defaults to "3"
   * (the Chandelier Exit convention). Sizing the trail to volatility is what keeps a fixed
   * percentage from sitting inside a volatile instrument's normal noise.
   */
  atrMultiple: positiveNumberString.default('3'),
  /**
   * Order type used to exit. `"limit"` (default) places the sell at the trail target — guaranteed
   * price, but may not fill on a gap. `"market"` guarantees fill at the prevailing price.
   */
  exitOrder: z.enum(['limit', 'market']).default('limit'),
  /**
   * Trail percentage to use while the ATR is still warming up. When omitted, the strategy holds
   * without a stop until the ATR is stable (it keeps tracking the peak so the trail is correct
   * the moment volatility is known).
   */
  fallbackTrailDownPct: positiveNumberString.optional(),
  /** Upper clamp on the derived trail percentage, so a volatility spike can't widen it without bound. */
  maxTrailDownPct: positiveNumberString.optional(),
  /** Lower clamp on the derived trail percentage, so a quiet stretch can't tighten it into the noise. */
  minTrailDownPct: positiveNumberString.optional(),
  /**
   * Optional initial peak price. When set, the peak seeds from this value on attach instead of the
   * attach candle's `high`, then ratchets up normally. Useful to anchor on a known cost basis or
   * swing high.
   */
  pivotPrice: positiveNumberString.optional(),
});

export type DynamicTrailConfig = z.input<typeof DynamicTrailSchema>;
