export function getMaximum(values: number[]) {
  let max = Number.MIN_SAFE_INTEGER;
  for (const value of values) {
    if (max < value) {
      max = value;
    }
  }
  return max;
}
