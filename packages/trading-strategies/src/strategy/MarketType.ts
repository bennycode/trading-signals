/**
 * Market regime a strategy is designed to operate in. A strategy may declare
 * multiple values when it is genuinely effective in more than one regime
 * (e.g. a confluence strategy that trades both up- and downtrends).
 */
export const MarketType = {
  /** Down-trending market: lower highs and lower lows. */
  BEARISH: 'bearish',
  /** Reference strategy used to measure other strategies against (e.g. random or no-op baselines). */
  BENCHMARK: 'benchmark',
  /** Up-trending market: higher highs and higher lows. */
  BULLISH: 'bullish',
  /** Sideways market: price oscillates between support and resistance. */
  RANGING: 'ranging',
  /** Pipeline utility / base class — provides shared behavior, not a tradable view of the market. */
  UTILITY: 'utility',
} as const;
export type MarketType = (typeof MarketType)[keyof typeof MarketType];
