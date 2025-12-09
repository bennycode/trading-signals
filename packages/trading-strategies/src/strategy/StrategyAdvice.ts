import {StrategySignal} from './StrategySignal.js';

export type StrategyAdviceBase = {
  /** The amount to buy (quantity of an asset, e.g., number of stocks) or spend (fiat currency to invest). */
  amount?: Big;
  price?: Big;
  signal: StrategySignal;
  /** A user-defined reason why this advice was made. */
  reason?: string;
};

export interface StrategyAdviceLimitSellOrder extends StrategyAdviceBase {
  price: Big;
  signal: typeof StrategySignal.SELL_LIMIT;
}

export interface StrategyAdviceLimitBuyOrder extends StrategyAdviceBase {
  price: Big;
  signal: typeof StrategySignal.BUY_LIMIT;
}

export interface StrategyAdviceMarketSellOrder extends StrategyAdviceBase {
  price: null;
  signal: typeof StrategySignal.SELL_MARKET;
}

/**
 * Enables the following scenarios:
 * - Buy a fixed asset quantity at the current market price
 * - Spend a fixed counter amount to buy at the current market price
 */
export interface StrategyAdviceMarketBuyOrder extends StrategyAdviceBase {
  amountInCounter: boolean;
  price: null;
  signal: typeof StrategySignal.BUY_MARKET;
}

export type StrategyAdviceLimitOrder = StrategyAdviceLimitSellOrder | StrategyAdviceLimitBuyOrder;

export type StrategyAdviceMarketOrder = StrategyAdviceMarketSellOrder | StrategyAdviceMarketBuyOrder;

export type StrategyAdvice = StrategyAdviceLimitOrder | StrategyAdviceMarketOrder;
