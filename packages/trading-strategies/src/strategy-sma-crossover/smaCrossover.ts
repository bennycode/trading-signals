import {parse} from 'ms';
import {z} from 'zod';
import {SMA} from 'trading-signals';
import {defineStrategy, every} from '../engine/index.js';
import {MarketType} from '../strategy/MarketType.js';
import {timeframeString} from '../util/validators.js';

const barCount = z.number().int().positive();

export const SmaCrossoverSchema = z
  .object({
    /** Number of bars in the fast SMA. */
    fastPeriod: barCount.default(10),
    /** Bar size the fast SMA is computed on. */
    fastTimeframe: timeframeString.default('1m'),
    /** Number of bars in the slow SMA. */
    slowPeriod: barCount.default(20),
    /** Bar size the slow SMA is computed on. */
    slowTimeframe: timeframeString.default('5m'),
  })
  .refine(
    config =>
      // Compared as durations rather than as text: "1m" and "60s" are the same bar.
      config.fastPeriod !== config.slowPeriod || parse(config.fastTimeframe) !== parse(config.slowTimeframe),
    {
      message: 'The fast and slow SMA must differ in period or timeframe, otherwise they never cross',
      path: ['fastPeriod'],
    }
  );

export type SmaCrossoverConfig = z.input<typeof SmaCrossoverSchema>;
type Settings = z.output<typeof SmaCrossoverSchema>;

function fastLabel({config, fast}: {config: Settings; fast: number}): string {
  return `SMA${config.fastPeriod}@${config.fastTimeframe} (${fast.toFixed(2)})`;
}

function slowLabel({config, slow}: {config: Settings; slow: number}): string {
  return `SMA${config.slowPeriod}@${config.slowTimeframe} (${slow.toFixed(2)})`;
}

/**
 * Classic dual-SMA crossover. Each average has its own bar count and its own bar size, so an
 * SMA10 on one-minute bars can be crossed against an SMA20 on five-minute bars.
 *
 * Both rules are written as `when: {becomes: ...}`, which is what makes them fire at the crossing
 * itself rather than on every bar the fast average spends on one side of the slow.
 */
export const SmaCrossover = defineStrategy(SmaCrossoverSchema)({
  indicators: {
    fast: every(
      config => config.fastTimeframe,
      config => new SMA(config.fastPeriod)
    ),
    slow: every(
      config => config.slowTimeframe,
      config => new SMA(config.slowPeriod)
    ),
  },
  long: {
    close: {
      because: facts => `${fastLabel(facts)} crossed below ${slowLabel(facts)}`,
      quantity: 'all',
      /*
       * `<=`, so a fast average that falls level with the slow one closes rather than waiting for
       * it to go further, which on a flat market may never happen.
       */
      when: {becomes: ({fast, slow}) => fast <= slow},
    },
    open: {
      because: facts => `${fastLabel(facts)} crossed above ${slowLabel(facts)}`,
      spend: 'all',
      when: {becomes: ({fast, slow}) => fast > slow},
    },
  },
  markets: [MarketType.BULLISH, MarketType.BEARISH],
  name: '@typedtrader/strategy-sma-crossover',
});
