export function getLastFromForEach<T, R>(
  array: readonly T[],
  callback: (value: T, index: number, array: readonly T[]) => R
): R | null {
  let lastValue: R | null = null;

  array.forEach((item, index) => {
    lastValue = callback(item, index, array);
  });

  return lastValue;
}
