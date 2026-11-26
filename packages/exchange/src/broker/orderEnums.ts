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
  /** Rests until the market reaches its trigger, then takes whatever price is available. */
  STOP: 'STOP',
  /**
   * Rests until the market reaches its trigger, then rests again as a limit order. It cannot fill
   * worse than its limit, and a gap straight through both prices leaves it unfilled, which is the
   * trade-off against {@link OrderType.STOP}.
   */
  STOP_LIMIT: 'STOP_LIMIT',
} as const;
export type OrderType = (typeof OrderType)[keyof typeof OrderType];

export const OrderPosition = {
  LONG: 'LONG',
  SHORT: 'SHORT',
} as const;
export type OrderPosition = (typeof OrderPosition)[keyof typeof OrderPosition];
