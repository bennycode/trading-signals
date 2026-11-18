import Big from 'big.js';
import {OrderType, type FeeRate} from '../Broker.js';

/**
 * IBKR's Fixed US-equity commission: USD 0.005 per share, at least USD 1.00 per order, never more
 * than 1% of trade value. Read off a live account's own `whatif` previews for Ford at USD 11.50 —
 * 1 share costs 0.12, 2 cost 0.23, 5 cost 0.58, and 10 through 100 all cost 1.00, which is
 * `min(max(0.005 × shares, 1.00), 1% × notional)` at every point.
 *
 * The Tiered schedule (0.0035 per share, 0.35 minimum) does not apply, and the 1% cap is what
 * makes a small order cheap: a single share is billed 1% of 11.50 rather than the 1.00 minimum.
 *
 * @see https://www.interactivebrokers.com/en/pricing/commissions-stocks.php
 */
export const IBKR_COMMISSION_PER_SHARE = new Big('0.005');
export const IBKR_COMMISSION_MINIMUM = new Big('1');
export const IBKR_COMMISSION_MAX_RATE = new Big('0.01');

/**
 * The schedule worked out locally, for when IBKR's own preview is unavailable — a backtest has no
 * session to ask.
 *
 * Billed per share, so the share count is recovered from the notional and the price. The result is
 * rounded up to whole cents, which is how IBKR bills: 1% of USD 11.50 is 0.115 and the preview
 * quotes 0.12.
 */
export function ibkrCommissionFor(notional: Big, price: Big): Big {
  if (notional.lte(0) || price.lte(0)) {
    return new Big(0);
  }

  const shares = notional.div(price);
  const perShare = IBKR_COMMISSION_PER_SHARE.mul(shares);
  const withFloor = perShare.lt(IBKR_COMMISSION_MINIMUM) ? IBKR_COMMISSION_MINIMUM : perShare;
  const cap = notional.mul(IBKR_COMMISSION_MAX_RATE);
  const billed = withFloor.gt(cap) ? cap : withFloor;

  return new Big(billed.toFixed(2, Big.roundUp));
}

/**
 * Reads the figure out of a `whatif` commission, which is a display string rather than a number:
 * `"1.70 USD"`, a bare `"0.35"`, or a range like `"0.11 ... 0.12 USD"` when IBKR will not commit
 * to one value. The upper bound is taken, so an estimate is never optimistic.
 *
 * Stripping non-numeric characters instead would turn that range into `"0.11...0.12"`, which is
 * not a number — the throw was being swallowed and every ranged quote fell back to local
 * arithmetic.
 */
export function parseIbkrCommission(commission: string | null | undefined): Big | undefined {
  const figures = commission?.match(/\d+(?:\.\d+)?/g);
  const highest = figures?.at(-1);
  return highest === undefined ? undefined : new Big(highest);
}

/**
 * IBKR's commission as a rate, which it is not: the schedule has a per-order floor and a cap, so
 * the true rate depends on the order's size and no single number covers it. This reports the rate
 * a large order pays, `0.005 / price` under the 1% ceiling.
 *
 * Prefer `estimateFee`, which knows the notional and so can apply the floor and the cap — for a
 * small order those dominate, and this rate understates the fee several-fold.
 */
export function ibkrFeeRates(price: Big): FeeRate {
  const rate = price.gt(0) ? IBKR_COMMISSION_PER_SHARE.div(price) : IBKR_COMMISSION_MAX_RATE;
  const capped = rate.gt(IBKR_COMMISSION_MAX_RATE) ? IBKR_COMMISSION_MAX_RATE : rate;

  return {
    [OrderType.LIMIT]: capped,
    [OrderType.MARKET]: capped,
  };
}
