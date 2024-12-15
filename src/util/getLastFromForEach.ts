export function getLastFromForEach<T, R>(
  array: T[],
  callback: (value: T, index: number, array: T[]) => R
): R | undefined {
  let lastValue: R | undefined;

  array.forEach((item, index) => {
    lastValue = callback(item, index, array);
  });

  return lastValue;
}
