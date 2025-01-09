export function getLastFromForEach<T, R>(array: T[], callback: (value: T, index: number, array: T[]) => R): R | null {
  let lastValue: R | null = null;

  array.forEach((item, index) => {
    lastValue = callback(item, index, array);
  });

  return lastValue;
}
