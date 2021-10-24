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

export function getFasterAverage(values: number[]): number {
  return values.reduce((sum: number, x: number) => sum + x, 0) / values.length;
}
