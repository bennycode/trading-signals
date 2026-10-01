/**
 * How many units to buy or sell so that being stopped out costs a fixed share of the account. The
 * distance between entry and stop is the risk per unit, so a tighter stop yields a larger position
 * for the same risk budget — that is the point of sizing this way, and the reason a tight stop is
 * not automatically the safer choice.
 *
 * Works for both directions: the stop sits below the entry on a long and above it on a short, and
 * only the distance between them matters.
 *
 * `riskPercent` is a percentage, not a fraction: `1` risks 1% of the account, not 100%.
 *
 * The result is deliberately fractional, because a position can be (`0.0431 BTC`). Round it to the
 * exchange's step size before sending an order.
 *
 * @throws If any input is zero or negative, or if entry and stop are the same price, because a
 *   position sized against no risk per unit is unbounded.
 */
export function getPositionSize(accountValue: number, riskPercent: number, entryPrice: number, stopPrice: number) {
  if (accountValue <= 0) {
    throw new Error('Cannot size a position against a non-positive account value.');
  }

  if (riskPercent <= 0) {
    throw new Error('Cannot size a position against a non-positive risk percentage.');
  }

  if (entryPrice <= 0 || stopPrice <= 0) {
    throw new Error('Cannot size a position from a non-positive price.');
  }

  const riskPerUnit = Math.abs(entryPrice - stopPrice);

  if (riskPerUnit === 0) {
    throw new Error('Cannot size a position when the entry price equals the stop price.');
  }

  const size = (accountValue * (riskPercent / 100)) / riskPerUnit;

  // Comparing anything against `NaN` yields false, so a `NaN` input reaches this line unflagged.
  if (!Number.isFinite(size)) {
    throw new Error('Cannot size a position from inputs that do not produce a finite size.');
  }

  return size;
}
