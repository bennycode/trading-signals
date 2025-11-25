/**
 * Return the mean / average value.
 */
export function getAverage(values: number[]): number {
  return values.length ? values.reduce((sum: number, x: number) => sum + x, 0) / values.length : 0;
}
