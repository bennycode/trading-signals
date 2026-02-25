export type OrderBookQuote = {
  symbol: string;
  bidPrice: number;
  bidSize: number;
  askPrice: number;
  askSize: number;
  /** (bidSize - askSize) / (bidSize + askSize), range -1 to +1. Positive = buy pressure. */
  imbalance: number;
  timestamp: string;
};
