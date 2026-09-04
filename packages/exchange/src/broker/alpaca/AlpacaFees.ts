import Big from 'big.js';
import {OrderSide, type FeeRate, type OrderType} from '../Broker.js';
import type {TradingPair} from '../TradingPair.js';

/**
 * Alpaca's order payload carries no fee field, so every figure here is derived. Crypto fees can be
 * reconciled afterwards against per-execution `CFEE` activities; equity `FEE` activities are
 * day-aggregated with no order reference, so those cannot.
 *
 * @see https://docs.alpaca.markets/docs/crypto-fees
 */

/**
 * Alpaca rounds a fee up in whatever unit it bills. Deliberately not
 * `TradingRules.counter_increment`, which is the pair's *price* increment — `0.000000001` for BTC/USD.
 */
const FIAT_FEE_DECIMAL_PLACES = 2;

/** Alpaca's crypto trade increment is `0.000000001`, so a base-denominated fee rounds up to nine places. */
const BASE_FEE_DECIMAL_PLACES = 9;

export interface DatedRate {
  /** Inclusive ISO date (YYYY-MM-DD) from which `rate` applies. */
  from: string;
  rate: Big;
}

/**
 * SEC Section 31 fee on equity *sell* proceeds. Re-set annually and has been $0.00 for a whole
 * fiscal year, so it has to be dated rather than constant. Add the next window from the advisories.
 *
 * @see https://www.sec.gov/rules-regulations/fee-rate-advisories
 */
export const SEC_FEE_RATES: readonly DatedRate[] = [
  {from: '2020-02-18', rate: new Big('0.0000221')},
  {from: '2021-02-25', rate: new Big('0.0000051')},
  {from: '2022-05-14', rate: new Big('0.0000229')},
  {from: '2023-02-27', rate: new Big('0.0000080')},
  {from: '2024-05-22', rate: new Big('0.0000278')},
  {from: '2025-05-14', rate: new Big('0')},
  {from: '2026-04-04', rate: new Big('0.0000206')},
];

/**
 * FINRA Trading Activity Fee, per share sold and capped per trade. Dated for the day FINRA moves it.
 *
 * @see https://www.finra.org/rules-guidance/guidance/trading-activity-fee
 */
const TAF_RATES: readonly DatedRate[] = [{from: '2023-01-01', rate: new Big('0.000166')}];

/** FINRA caps the Trading Activity Fee per trade. */
const TAF_CAP = new Big('8.30');

function findRate(rates: readonly DatedRate[], tradedAt: string): Big {
  for (let index = rates.length - 1; index >= 0; index--) {
    const entry = rates[index];
    if (entry && tradedAt >= entry.from) {
      return entry.rate;
    }
  }
  return new Big(0);
}

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
  /** ISO timestamp of the execution, used to pick the regulatory rates in force that day. */
  tradedAt: string;
}

export interface AlpacaRegulatoryFeeRequest {
  /** Sale principal in the counter currency. */
  proceeds: Big.BigSource;
  /** Shares sold; fractional shares are pro-rated. */
  quantity: Big.BigSource;
  side: OrderSide;
  /** ISO timestamp of the execution. */
  tradedAt: string;
}

/**
 * SEC and FINRA fees Alpaca passes through on equity sells. CAT is not modelled: its per-share rate
 * is too small to pin down from observed activity.
 *
 * Deliberately unrounded. Alpaca rounds a whole day up to the penny once, so rounding per trade
 * would multiply the fee by the number of trades.
 *
 * @see https://alpaca.markets/support/regulatory-fees
 */
export function getRegulatoryFee(request: AlpacaRegulatoryFeeRequest): Big {
  const {proceeds, quantity, side, tradedAt} = request;

  if (side !== OrderSide.SELL) {
    return new Big(0);
  }

  const secFee = new Big(proceeds).times(findRate(SEC_FEE_RATES, tradedAt));
  const tafFee = new Big(quantity).times(findRate(TAF_RATES, tradedAt));

  return secFee.plus(tafFee.gt(TAF_CAP) ? TAF_CAP : tafFee);
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
 *
 * Alpaca bills per execution, so an order filled in several legs is charged a separately rounded fee
 * for each and computing once over the whole order can come out low.
 */
export function getTradeCost(request: AlpacaTradeCostRequest): AlpacaTradeCost {
  const {isCrypto, orderType, pair, price, quantity, rates, side, tradedAt} = request;

  const feeAsset = getCreditedAsset(pair, side, isCrypto);
  const notional = new Big(quantity).times(price);

  if (!isCrypto) {
    const fee = getRegulatoryFee({proceeds: notional, quantity, side, tradedAt});
    return {fee, feeAsset};
  }

  const rate = rates[orderType];

  if (feeAsset === pair.base) {
    return {fee: new Big(quantity).times(rate).round(BASE_FEE_DECIMAL_PLACES, Big.roundUp), feeAsset};
  }

  return {fee: notional.times(rate).round(FIAT_FEE_DECIMAL_PLACES, Big.roundUp), feeAsset};
}
