import type {Big} from 'big.js';
import {StrategySignal} from './StrategySignal.js';

type StrategyAdviceBase = {
  signal: StrategySignal;
  /** A user-defined reason why this advice was made. */
  reason?: string;
};

type BaseAmount = {
  /** Quantity of the base asset (e.g., BTC in a BTC/USD pair). Use null to take as much as possible. */
  amount: Big | null;
  amountType: 'base';
};

type CounterAmount = {
  /** Quantity of the counter asset to spend/receive (e.g., USD in a BTC/USD pair). Use null to spend/receive as much as possible. */
  amount: Big | null;
  amountType: 'counter';
};

type LimitPrice = {price: Big};
type MarketPrice = {price: null};

export type StrategyAdviceLimitSellOrder = StrategyAdviceBase &
  BaseAmount &
  LimitPrice & {
    signal: typeof StrategySignal.SELL_LIMIT;
  };

export type StrategyAdviceLimitBuyOrder = StrategyAdviceBase &
  LimitPrice &
  (BaseAmount | CounterAmount) & {
    signal: typeof StrategySignal.BUY_LIMIT;
  };

export type StrategyAdviceMarketSellOrder = StrategyAdviceBase &
  BaseAmount &
  MarketPrice & {
    signal: typeof StrategySignal.SELL_MARKET;
  };

/**
 * Enables the following scenarios:
 * - Buy a fixed asset quantity at the current market price
 * - Spend a fixed counter amount to buy at the current market price
 */
export type StrategyAdviceMarketBuyOrder = StrategyAdviceBase &
  MarketPrice &
  (BaseAmount | CounterAmount) & {
    signal: typeof StrategySignal.BUY_MARKET;
  };

export type StrategyAdviceLimitOrder = StrategyAdviceLimitSellOrder | StrategyAdviceLimitBuyOrder;

export type StrategyAdviceMarketOrder = StrategyAdviceMarketSellOrder | StrategyAdviceMarketBuyOrder;

export type StrategyAdvice = StrategyAdviceLimitOrder | StrategyAdviceMarketOrder;
