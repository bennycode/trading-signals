import Big from 'big.js';

export function getAverage(values: Big[]): Big {
  if (values.length === 0) {
    return new Big(0);
  }

  const sum = values.reduce((prev: Big, current: Big) => {
    return prev.add(current);
  }, new Big(0));

  return sum.div(values.length);
}
