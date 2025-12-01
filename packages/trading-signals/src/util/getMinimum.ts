export function getMinimum(values: number[]) {
  let min = Number.MAX_SAFE_INTEGER;
  for (const value of values) {
    if (min > value) {
      min = value;
    }
  }
  return min;
}
