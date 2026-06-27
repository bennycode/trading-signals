/**
 * Deterministic, equal-weight, low-churn rebalance for the momentum-rotation strategy.
 *
 * Given the current holdings and a fresh target set (the top picks from momentum + scorecard), it
 * works out the minimum set of trades:
 *
 * - **Sell** any holding that has dropped out of the target set (liquidate it fully).
 * - **Buy** any target not yet held, sized to an equal-weight slice of total equity.
 * - **Hold** anything that is in both, with no trade at all.
 *
 * "Low churn" is the point: positions that stay in the set are left exactly as they are (no
 * re-weighting drift), so an unchanged target set produces an empty plan and costs nothing in fees.
 * The maths is pure and independent of any broker, so it is fully unit-testable.
 */

export interface Holding {
  ticker: string;
  /** Current market value of the position, in account currency. */
  marketValueUsd: number;
}

export interface RebalanceOrder {
  ticker: string;
  side: 'BUY' | 'SELL';
  /** Dollar amount to trade (a notional / fractional order). Sells liquidate the full position. */
  notionalUsd: number;
}

export interface RebalancePlan {
  sells: RebalanceOrder[];
  buys: RebalanceOrder[];
  /** Tickers already held that remain in the target set — deliberately left untouched. */
  holds: string[];
}

/**
 * @param holdings        Current positions and their market values.
 * @param targets         The desired tickers (e.g. the top 5 from the scorecard).
 * @param totalEquityUsd  Total account equity (cash + positions), used to size new buys.
 * @param positionCount   Equal-weight divisor (e.g. 5). Dividing by the configured count rather than
 *                        the number of targets means an under-filled set leaves the remainder in cash.
 */
export function computeRebalance(
  holdings: Holding[],
  targets: string[],
  totalEquityUsd: number,
  positionCount: number
): RebalancePlan {
  const targetSet = new Set(targets);
  const heldSet = new Set(holdings.map(holding => holding.ticker));
  const perPositionUsd = totalEquityUsd / positionCount;

  const sells: RebalanceOrder[] = holdings
    .filter(holding => !targetSet.has(holding.ticker))
    .map(holding => ({notionalUsd: holding.marketValueUsd, side: 'SELL', ticker: holding.ticker}));

  const buys: RebalanceOrder[] = targets
    .filter(ticker => !heldSet.has(ticker))
    .map(ticker => ({notionalUsd: perPositionUsd, side: 'BUY', ticker}));

  const holds = targets.filter(ticker => heldSet.has(ticker));

  return {buys, holds, sells};
}
