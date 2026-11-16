import type {z} from 'zod';
import {BollingerBands} from 'trading-signals';
import {defineStrategy, every, ProtectionSchema, stopLoss, takeProfit} from '../engine/index.js';
import {MarketType} from '../strategy/MarketType.js';

const BAR = '1h';
const PERIOD = 20;
const DEVIATION_MULTIPLIER = 2.5;

export const MeanReversionSchema = ProtectionSchema;

export type MeanReversionConfig = z.input<typeof MeanReversionSchema>;
type Settings = z.output<typeof MeanReversionSchema>;

/**
 * Buys when price falls back to the middle Bollinger Band and sells when it breaks above the
 * upper band, on the assumption that a range-bound market returns to its mean. Entries and exits
 * are judged on hourly bars; the stops are checked on every candle.
 */
export const MeanReversion = defineStrategy(MeanReversionSchema)({
  indicators: {
    bands: every(BAR, () => new BollingerBands(PERIOD, DEVIATION_MULTIPLIER)),
  },
  interval: BAR,
  long: {
    close: [
      stopLoss<Settings>({pct: ({config}) => config.stopLossPct}),
      takeProfit<Settings>({pct: ({config}) => config.takeProfitPct}),
      {
        because: ({bands, close}) => `Price ${close.toFixed(2)} broke above upper band ${bands.upper.toFixed(2)}`,
        when: ({bands, close}) => close > bands.upper,
      },
    ],
    open: {
      because: ({bands, close}) => `Price ${close.toFixed(2)} returned to middle band ${bands.middle.toFixed(2)}`,
      spend: 'all',
      when: ({bands, close}) => close <= bands.middle,
    },
  },
  markets: [MarketType.RANGING],
  name: '@typedtrader/strategy-mean-reversion',
});
