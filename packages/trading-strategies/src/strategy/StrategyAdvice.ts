import {StrategySignal} from './StrategySignal.js';

export type StrategyAdviceBase = {
  /** The amount for you want to buy (quantity of an asset, i.e. number of stocks) or spend (fiat you want to invest). */
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

export interface StrategyAdviceMarketBuyOrder extends StrategyAdviceBase {
  amountInCounter: boolean;
  price: null;
  signal: typeof StrategySignal.BUY_MARKET;
}

export type StrategyAdviceLimitOrder = StrategyAdviceLimitSellOrder | StrategyAdviceLimitBuyOrder;

export type StrategyAdviceMarketOrder = StrategyAdviceMarketSellOrder | StrategyAdviceMarketBuyOrder;

export type StrategyAdvice = StrategyAdviceLimitOrder | StrategyAdviceMarketOrder;
