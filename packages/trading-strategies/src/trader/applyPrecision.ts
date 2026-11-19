import Big from 'big.js';

/**
 * Rounds a value down to a step the exchange accepts. An exchange quotes prices and sizes in
 * increments, so what a rule asks for and what reaches the book are rarely the same number: a
 * limit of `100.123` on a one-cent increment is placed at `100.12`.
 *
 * Shared, because anything comparing advice against an order already on the book has to compare
 * what that advice would become — otherwise an unchanged order looks like a new one every time.
 */
export function applyPrecision(value: Big, increment: string): Big {
  const step = new Big(increment);
  return value.div(step).round(0, Big.roundDown).mul(step);
}
