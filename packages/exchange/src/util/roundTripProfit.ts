import Big from 'big.js';
import type {BigSource} from 'big.js';

/**
 * One buy-then-sell round trip. Fee rates are fractions of the traded notional
 * (price × quantity): `0.001` is 0.1%. Use the maker rate (`FeeRate.LIMIT`) or taker
 * rate (`FeeRate.MARKET`) for each leg depending on the order type you would place.
 */
export interface RoundTripInput {
  /** Average price the position was bought at (its cost basis per unit). */
  entryPrice: BigSource;
  /** Price the position would be sold at. */
  exitPrice: BigSource;
  /** Base quantity being sold. */
  quantity: BigSource;
  /** Fee rate paid on the buy, as a fraction of notional. */
  entryFeeRate: BigSource;
  /** Fee rate paid on the sell, as a fraction of notional. */
  exitFeeRate: BigSource;
}

export interface RoundTripProfit {
  /** Fee paid on the buy (entryPrice × quantity × entryFeeRate). */
  entryFee: Big;
  /** Fee paid on the sell (exitPrice × quantity × exitFeeRate). */
  exitFee: Big;
  /** Total spent to acquire the position, including the buy fee. */
  entryCost: Big;
  /** Amount received from the sale, after the sell fee. */
  exitProceeds: Big;
  /** `exitProceeds − entryCost`. Positive means the round trip nets a profit. */
  netProfit: Big;
  /** {@link netProfit} as a percentage of {@link entryCost}. */
  netProfitPercent: Big;
  /** Lowest sell price at which the round trip breaks even after both fees. */
  breakEvenPrice: Big;
  /** Whether selling nets a profit after both fees. */
  isProfitable: boolean;
}

/**
 * Answers the question a trader actually cares about before selling: *after paying the
 * fee on both the buy and the sell, does this sale come out ahead of what I paid?* A
 * naive "exit price > entry price" check says yes on trades that a round trip of fees
 * quietly turns into a loss, which is how a high-churn strategy bleeds money while
 * looking like it wins more often than it loses.
 *
 * The verdict is fee-inclusive on both legs and also reports the {@link RoundTripProfit.breakEvenPrice}
 * — the minimum sell price that clears both fees — so a caller can hold out for it.
 */
export function calculateRoundTripProfit(input: RoundTripInput): RoundTripProfit {
  const entryPrice = new Big(input.entryPrice);
  const exitPrice = new Big(input.exitPrice);
  const quantity = new Big(input.quantity);
  const entryFeeRate = new Big(input.entryFeeRate);
  const exitFeeRate = new Big(input.exitFeeRate);

  const entryNotional = entryPrice.mul(quantity);
  const exitNotional = exitPrice.mul(quantity);
  const entryFee = entryNotional.mul(entryFeeRate);
  const exitFee = exitNotional.mul(exitFeeRate);

  const entryCost = entryNotional.plus(entryFee);
  const exitProceeds = exitNotional.minus(exitFee);
  const netProfit = exitProceeds.minus(entryCost);
  const netProfitPercent = entryCost.eq(0) ? new Big(0) : netProfit.div(entryCost).mul(100);

  // Solve exitPrice·(1 − exitFeeRate) = entryPrice·(1 + entryFeeRate) for exitPrice.
  const proceedsFactor = new Big(1).minus(exitFeeRate);
  if (proceedsFactor.lte(0)) {
    throw new Error(`exitFeeRate must be below 1 (100%), got ${exitFeeRate.toString()}`);
  }
  const breakEvenPrice = entryPrice.mul(new Big(1).plus(entryFeeRate)).div(proceedsFactor);

  return {
    breakEvenPrice,
    entryCost,
    entryFee,
    exitFee,
    exitProceeds,
    isProfitable: netProfit.gt(0),
    netProfit,
    netProfitPercent,
  };
}

/** Convenience wrapper over {@link calculateRoundTripProfit} returning just the profit verdict. */
export function isProfitableAfterFees(input: RoundTripInput) {
  return calculateRoundTripProfit(input).isProfitable;
}
