import Big from 'big.js';
import {OrderSide, type FeeRate, type OrderType} from '../Broker.js';
import type {TradingPair} from '../TradingPair.js';

/**
 * Alpaca's order payload carries no fee field, so every figure here is derived rather than reported.
 *
 * @see https://docs.alpaca.markets/docs/crypto-fees
 */

/**
 * Alpaca rounds fiat fees up to the penny. Deliberately not `TradingRules.counter_increment`, which
 * is the pair's *price* increment — `0.000000001` for BTC/USD.
 */
const FIAT_FEE_DECIMAL_PLACES = 2;

export interface AlpacaTradeCost {
  fee: Big;
  feeAsset: string;
}

export interface AlpacaTradeCostRequest {
  isCrypto: boolean;
  orderType: OrderType;
  pair: TradingPair;
  /** Execution price, in counter units per base unit. */
  price: Big.BigSource;
  /** Executed quantity, in base units. */
  quantity: Big.BigSource;
  rates: FeeRate;
  side: OrderSide;
}

/**
 * Crypto fees come out of the asset you are credited with, so a BUY pays in the base asset and a
 * SELL in the counter. Everything else settles in the counter.
 */
export function getCreditedAsset(pair: TradingPair, side: OrderSide, isCrypto: boolean): string {
  if (isCrypto && side === OrderSide.BUY) {
    return pair.base;
  }
  return pair.counter;
}

/**
 * Limit orders are billed at the maker rate and everything else at the taker rate. That is the best
 * available signal, not the truth: a marketable limit order pays taker, and the payload does not
 * say whether the fill added or removed liquidity.
 */
export function getTradeCost(request: AlpacaTradeCostRequest): AlpacaTradeCost {
  const {isCrypto, orderType, pair, price, quantity, rates, side} = request;

  const feeAsset = getCreditedAsset(pair, side, isCrypto);

  if (!isCrypto) {
    return {fee: new Big(0), feeAsset};
  }

  const rate = rates[orderType];
  const notional = new Big(quantity).times(price);

  if (feeAsset === pair.base) {
    // Left exact: the penny rounding seen on fiat fees has no documented crypto equivalent.
    return {fee: new Big(quantity).times(rate), feeAsset};
  }

  return {fee: notional.times(rate).round(FIAT_FEE_DECIMAL_PLACES, Big.roundUp), feeAsset};
}
