export function getMedian(values: number[]): number {
  const n = values.length;

  if (n === 0) {
    throw new Error('Cannot calculate median of empty array');
  }

  // For even number of items, take the average of the two middle items
  if (n % 2 === 0) {
    return (values[n / 2 - 1] + values[n / 2]) / 2;
  }

  // For odd number of items, return the middle item
  return values[Math.floor(n / 2)];
}
