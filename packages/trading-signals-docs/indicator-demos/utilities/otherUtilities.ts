import type {UtilityInfoConfig} from './types';

export const otherUtilities: UtilityInfoConfig[] = [
  {
    description: 'Returns a single quartile (Q1, median, or Q3) from a dataset',
    details:
      'Pass `0.25` for the first quartile (Q1, 25th percentile), `0.5` for the median (Q2), or `0.75` for the third quartile (Q3, 75th percentile). Useful for measuring spread and detecting outliers (e.g. computing the interquartile range as `Q3 − Q1`).',
    id: 'quartile',
    kind: 'info',
    name: 'getQuartile',
    signature: 'getQuartile(values: number[], q: 0.25 | 0.5 | 0.75): number',
  },
  {
    description: 'Generates price grid levels for grid trading strategies',
    details:
      'Splits a price range into `levels` evenly spaced points between `lower` and `upper`. Choose `arithmetic` for equal price steps or `geometric` for equal percentage steps. An optional `tickSize` rounds each level to a tradable increment. Used by grid trading strategies that place buy/sell orders at fixed intervals.',
    id: 'grid',
    kind: 'info',
    name: 'getGrid',
    signature:
      "getGrid({ lower, upper, levels, spacing, tickSize? }): number[]\n// spacing: 'arithmetic' | 'geometric'",
  },
  {
    description: 'Returns the lengths and percentage moves of continuous up- or down-streaks in a price series',
    details:
      'Walks the price series and groups consecutive moves in the same direction. Pass `up` to keep uptrends, `down` for downtrends. Each returned `Streak` reports the number of consecutive moves and the total percentage change across the streak. Useful for momentum analysis and indicators that need streak length as input (e.g. Connors RSI).',
    id: 'streaks',
    kind: 'info',
    name: 'getStreaks',
    signature:
      "getStreaks(prices: number[], keepSide: 'up' | 'down'): Streak[]\n// type Streak = { length: number; percentage: number }",
  },
  {
    description: 'Boolean helpers that test whether a date falls on a given weekday in a specific timezone',
    details:
      'Each helper takes an IANA timezone identifier (e.g. `"America/New_York"`, `"Europe/London"`) and an optional `Date` (defaults to now). Useful for filtering strategies by trading session or analysing day-of-week effects without pulling in a heavy date library.',
    id: 'weekday-helpers',
    kind: 'info',
    name: 'isMonday / isTuesday / …',
    signature: 'isMonday(timezone: string, date?: Date): boolean\n// also: isTuesday, isWednesday, …, isSunday',
  },
  {
    description: 'Appends or replaces the last value in a bounded ring buffer',
    details:
      'Helper used when implementing custom indicators. Pass `replace: false` to append a new value, `replace: true` to overwrite the most recent one (for streaming/live candles). When the array would exceed `maxLength`, the oldest element is shifted out and returned; otherwise the function returns `null`.',
    id: 'push-update',
    kind: 'info',
    name: 'pushUpdate',
    signature: 'pushUpdate<T>(array: T[], replace: boolean, item: T, maxLength: number): T | null | undefined',
  },
];
