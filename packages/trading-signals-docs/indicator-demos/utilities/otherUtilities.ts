import type {UtilityInfoConfig} from './types';

export const otherUtilities: UtilityInfoConfig[] = [
  {
    kind: 'info',
    id: 'quartile',
    name: 'getQuartile',
    description: 'Calculates Q1, Q2 (median), and Q3 values for a dataset',
    signature: 'getQuartile(values: number[]): { q1: number; q2: number; q3: number }',
    details:
      'Returns the three quartiles of a sorted dataset. Q1 is the 25th percentile, Q2 is the median, and Q3 is the 75th percentile. Useful for measuring spread and detecting outliers (e.g. via the interquartile range Q3 − Q1).',
  },
  {
    kind: 'info',
    id: 'grid',
    name: 'getGrid',
    description: 'Generates price grid levels for grid trading strategies',
    signature: 'getGrid({ lowPrice, highPrice, intervals }): number[]',
    details:
      'Splits a price range into evenly spaced levels. Used by grid trading strategies that place buy/sell orders at fixed intervals between a low and a high price.',
  },
  {
    kind: 'info',
    id: 'streaks',
    name: 'getStreaks',
    description: 'Identifies consecutive positive/negative value sequences',
    signature: 'getStreaks(values: number[]): number[]',
    details:
      'Walks the series and returns the current streak length at each step — positive numbers for up-streaks, negative numbers for down-streaks. Useful for momentum analysis and as an input to indicators like the Connors RSI.',
  },
  {
    kind: 'info',
    id: 'weekday',
    name: 'getWeekday',
    description: 'Extracts weekday information from timestamps',
    signature: 'getWeekday(timestamp: number | string | Date): Weekday',
    details:
      'Returns the weekday for a given timestamp. Useful for filtering strategies by trading session or analyzing day-of-week effects on returns.',
  },
  {
    kind: 'info',
    id: 'push-update',
    name: 'pushUpdate',
    description: 'Pushes or replaces the latest value in a bounded ring buffer',
    signature: 'pushUpdate<T>(buffer: T[], value: T, replace: boolean, maxSize: number): void',
    details:
      'Helper used when implementing custom indicators. Appends a new value to a bounded buffer or replaces the most recent one (for streaming/live updates), trimming the buffer to `maxSize`.',
  },
];
