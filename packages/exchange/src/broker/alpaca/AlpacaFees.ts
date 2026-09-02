import Big from 'big.js';
import {OrderSide, type FeeRate, type OrderType} from '../Broker.js';
import type {TradingPair} from '../TradingPair.js';

/**
 * Alpaca's order payload carries no fee field, and the authoritative `CFEE` account activity is a
 * daily aggregate without an order reference, so a per-fill fee has to be derived. Everything in
 * this module is therefore an *estimate* — reconcile against account activities when exact figures
 * matter.
 *
 * @see https://docs.alpaca.markets/docs/crypto-fees
 * @see https://files.alpaca.markets/disclosures/library/BrokFeeSched.pdf
 */

/**
 * Alpaca rounds fiat fees *up* to the penny, both for crypto commissions and for regulatory
 * pass-through fees.
 *
 * This is deliberately not `TradingRules.counter_increment`: that is the pair's *price* increment,
 * which for BTC/USD is `0.000000001`. Price precision and billing precision are different things.
 *
 * @see https://alpaca.markets/support/regulatory-fees
 */
const FIAT_FEE_DECIMAL_PLACES = 2;

interface DatedRate {
  /** Inclusive ISO date from which `rate` applies. */
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
 * Update this table from the SEC's fee rate advisories when a new fiscal year takes effect.
 *
 * @see https://www.sec.gov/rules-regulations/fee-rate-advisories
 */
const SEC_FEE_RATES: readonly DatedRate[] = [
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
  /**
   * The same fee expressed in `pair.counter`, so callers can compare costs across trades without
   * caring which asset was debited. Equal to `fee` whenever `feeAsset` is the counter.
   */
  feeInCounter: Big;
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
 * `quantity × price × rate`.
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
    return {fee, feeAsset, feeInCounter: fee};
  }

  const rate = rates[orderType];
  const feeInCounter = notional.times(rate).round(FIAT_FEE_DECIMAL_PLACES, Big.roundUp);

  if (feeAsset === pair.base) {
    /*
     * Base-denominated fees are left exact. The penny rounding observed on fiat fees has no
     * documented equivalent for crypto quantities, and BTC/USD's trade increment (0.000000001) is
     * fine enough that inventing one would distort the number more than leaving it alone.
     */
    return {fee: new Big(quantity).times(rate), feeAsset, feeInCounter};
  }

  return {fee: feeInCounter, feeAsset, feeInCounter};
}
