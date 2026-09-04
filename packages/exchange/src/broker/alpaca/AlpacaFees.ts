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
 * Stocks and ETFs return a zero fee. Alpaca charges no commission on them, and the regulatory
 * pass-through fees it does charge (SEC/REG, FINRA TAF, CAT) arrive as separate day-aggregated
 * `FEE` activities that cannot be attributed to an order.
 *
 * @see https://alpaca.markets/support/regulatory-fees
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
    /*
     * Base-denominated fees are left exact. The penny rounding observed on fiat fees has no
     * documented equivalent for crypto quantities, and BTC/USD's trade increment (0.000000001) is
     * fine enough that inventing one would distort the number more than leaving it alone.
     */
    return {fee: new Big(quantity).times(rate), feeAsset};
  }

  return {fee: notional.times(rate).round(FIAT_FEE_DECIMAL_PLACES, Big.roundUp), feeAsset};
}
