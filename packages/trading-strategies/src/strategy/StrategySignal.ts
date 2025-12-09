export const StrategySignal = {
  BUY_LIMIT: 'BUY_LIMIT',
  BUY_MARKET: 'BUY_MARKET',
  NONE: 'NONE',
  SELL_LIMIT: 'SELL_LIMIT',
  SELL_MARKET: 'SELL_MARKET',
} as const;

export type StrategySignal = (typeof StrategySignal)[keyof typeof StrategySignal];
