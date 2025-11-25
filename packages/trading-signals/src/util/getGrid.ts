export type GridConfig = {
  lower: number;
  upper: number;
  levels: number;
  spacing: 'arithmetic' | 'geometric';
  tickSize?: number;
};

export function getGrid({lower, upper, levels, tickSize, spacing}: GridConfig): number[] {
  const prices: number[] = [];

  if (spacing === 'arithmetic') {
    const step = (upper - lower) / (levels - 1);
    for (let i = 0; i < levels; i++) {
      prices.push(lower + step * i);
    }
  } else {
    const ratio = Math.pow(upper / lower, 1 / (levels - 1));
    for (let i = 0; i < levels; i++) {
      prices.push(lower * Math.pow(ratio, i));
    }
  }

  if (tickSize) {
    const roundToTick = (x: number) => Math.round(x / tickSize) * tickSize;
    return prices.map(roundToTick);
  }

  return prices;
}
