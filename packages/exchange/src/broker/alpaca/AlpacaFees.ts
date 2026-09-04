import Big from 'big.js';
import {OrderSide, type FeeRate, type OrderType} from '../Broker.js';
import type {TradingPair} from '../TradingPair.js';

/**
 * Alpaca's order payload carries no fee field, so a per-fill fee has to be derived here. How well
 * that can be checked afterwards differs by asset class:
 *
 * - Crypto fees post as `CFEE` activities within seconds, one per execution, each carrying the
 *   `order_id`. They are therefore attributable, and this module's crypto figures can be
 *   reconciled exactly. (Alpaca's `order_id` query parameter does not filter `CFEE`, so the match
 *   has to be made client-side.)
 * - Equity regulatory fees post as `FEE` activities aggregated per day and per fee type, with no
 *   order, symbol or quantity. Nothing can attribute those to a trade, so `getRegulatoryFee` is an
 *   estimate with no per-fill ground truth.
 *
 * @see https://docs.alpaca.markets/docs/crypto-fees
 * @see https://files.alpaca.markets/disclosures/library/BrokFeeSched.pdf
 */

/**
 * Alpaca rounds a fee *up* in whatever unit it bills, so a fiat fee rounds up to the penny.
 *
 * This is deliberately not `TradingRules.counter_increment`: that is the pair's *price* increment,
 * which for BTC/USD is `0.000000001`. Price precision and billing precision are different things.
 *
 * @see https://alpaca.markets/support/regulatory-fees
 */
const FIAT_FEE_DECIMAL_PLACES = 2;

/**
 * Decimal places a base-denominated fee is rounded up to.
 *
 * Verified against a live account: a market BUY of 0.001254903 BTC at the 0.25% taker rate computes
 * to 0.0000031372575 BTC and was billed 0.000003138, one increment higher. Alpaca's crypto trade
 * increment is `0.000000001`, which is nine places.
 */
const BASE_FEE_DECIMAL_PLACES = 9;

export interface DatedRate {
  /** Inclusive ISO date (YYYY-MM-DD) from which `rate` applies. */
  from: string;
  rate: Big;
}

/**
 * SEC Section 31 fee, charged on the principal of equity and option *sells*, expressed as a rate
 * per dollar of proceeds.
 *
 * The SEC re-sets this annually to collect exactly its appropriation, so it moves a lot and has
 * been zero for long stretches — a hardcoded rate would invent fees. Every window below is
 * corroborated by `REG` activities on a live account: the $0.00 window shows up as sell days that
 * carry a `TAF` charge and no `REG` charge at all.
 *
 * Every window below was read out of the SEC's own Section 31 order. Add the next one from the
 * fee rate advisories when a new fiscal year takes effect.
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
 * FINRA Trading Activity Fee, charged per share sold and capped per trade. Unlike the SEC rate
 * this has held steady across everything observed, but it is table-driven for the day FINRA moves
 * it.
 *
 * @see https://www.finra.org/finra-data/browse-catalog/trading-activity-fee
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
  /** Fee amount, denominated in `feeAsset`. */
  fee: Big;
  /** Asset the fee is debited in. */
  feeAsset: string;
}

export interface AlpacaTradeCostRequest {
  /** `false` for stocks and ETFs, which pay no commission. */
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
 * Regulatory fees Alpaca passes through on equity sells: the SEC Section 31 fee on proceeds and
 * the FINRA Trading Activity Fee per share. Both are sell-side only, so a BUY costs nothing.
 *
 * **The result is deliberately not rounded.** Alpaca sums a whole day of trades per fee type and
 * rounds *that* up to the penny once, so rounding here would multiply the fee by the number of
 * trades. Verified on a live account: 48 shares across 9 sells on 2024-07-19 were billed $0.01 of
 * TAF in total, where a per-trade rounding would have reported $0.09. Leaving each trade
 * unrounded keeps a day's estimates summing to within one penny of the real bill.
 *
 * CAT is not modelled. It applies to both sides and is billed the same day-aggregated way, but its
 * per-share rate is too small to pin down from observed activity.
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
 * The asset Alpaca debits a fee from.
 *
 * Crypto fees are taken out of the *credited* asset — what you receive — so a BUY pays in the base
 * asset and a SELL pays in the counter. Everything else settles in the counter currency.
 */
export function getCreditedAsset(pair: TradingPair, side: OrderSide, isCrypto: boolean): string {
  if (isCrypto && side === OrderSide.BUY) {
    return pair.base;
  }
  return pair.counter;
}

/**
 * Derives the fee for a single Alpaca execution.
 *
 * The commission is `notional × rate` regardless of side; only the denomination changes. A BUY
 * billed in the base asset works out to `quantity × rate`, a SELL billed in the counter to
 * `quantity × price × rate`. Either way the result is rounded up, in the unit it is billed in.
 *
 * Alpaca bills per execution rather than per order, so an order that fills in several legs is
 * charged a separately rounded fee for each. Computing once over the whole order can therefore
 * come out up to one increment per leg low.
 *
 * Limit orders are billed at the maker rate and everything else at the taker rate. That is the best
 * available signal, not the truth: a marketable limit order executes as a taker, but the order
 * payload does not say whether the fill added or removed liquidity.
 *
 * Stocks and ETFs pay no commission, only the regulatory fees `getRegulatoryFee` covers.
 *
 * @see https://alpaca.markets/support/regulatory-fees
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
