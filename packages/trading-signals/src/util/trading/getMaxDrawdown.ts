/**
 * The deepest peak-to-trough decline of a series, in percent (`20` means "-20% from the peak") —
 * the worst loss anyone riding the series from a top to the following bottom would have endured.
 * A series that only rises reports `0`.
 *
 * @throws If no values are given, because a drawdown needs a series to decline through.
 */
export function getMaxDrawdown(values: number[]) {
  if (values.length === 0) {
    throw new Error('Cannot calculate the maximum drawdown of an empty series.');
  }

  let peak = values[0];
  let maxDrawdown = 0;

  for (const value of values) {
    if (value > peak) {
      peak = value;
    }

    const drawdown = peak > 0 ? ((peak - value) / peak) * 100 : 0;

    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  return maxDrawdown;
}
