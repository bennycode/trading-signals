import Big, {BigSource} from 'big.js';

export function getAverage(values: BigSource[]): Big {
  if (values.length === 0) {
    return new Big(0);
  }

  const sum = values.reduce((prev: Big, current: BigSource) => {
    return prev.add(current);
  }, new Big(0));

  return sum.div(values.length);
}
