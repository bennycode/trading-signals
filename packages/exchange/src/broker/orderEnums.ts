/**
 * The vocabulary an order is described in, kept apart from `Broker` so that modules the broker
 * itself imports can use these values without the two files importing each other.
 *
 * `Broker` re-exports all three, so `@typedtrader/exchange` consumers import them unchanged.
 */

export const OrderSide = {
  BUY: 'BUY',
  SELL: 'SELL',
} as const;
export type OrderSide = (typeof OrderSide)[keyof typeof OrderSide];

export const OrderType = {
  /** Maker */
  LIMIT: 'LIMIT',
  /** Taker */
  MARKET: 'MARKET',
} as const;
export type OrderType = (typeof OrderType)[keyof typeof OrderType];

export const OrderPosition = {
  LONG: 'LONG',
  SHORT: 'SHORT',
} as const;
export type OrderPosition = (typeof OrderPosition)[keyof typeof OrderPosition];
