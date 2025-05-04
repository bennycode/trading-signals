import {getFasterMedian, getMedian} from './getMedian.js';

/**
 * @see https://en.wikipedia.org/wiki/Quartile
 */
export function getQuartile(values: Big[], quartile: 0.25 | 0.5 | 0.75): Big {
  const sorted = [...values].sort((a, b) => a.cmp(b));
  const n = sorted.length;

  const medianIndex = Math.floor(n / 2);

  if (quartile === 0.25) {
    return getMedian(sorted.slice(0, medianIndex));
  } else if (quartile === 0.75) {
    if (n % 2 === 0) {
      // Even number of items: the upper half is the last n/2 items
      return getMedian(sorted.slice(medianIndex));
    }
    // Odd number of items: the upper half excludes the median
    return getMedian(sorted.slice(medianIndex + 1));
  }
  const pos = (sorted.length - 1) * quartile;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base].plus(sorted[base + 1].minus(sorted[base]).times(rest));
}

/**
 * @see https://en.wikipedia.org/wiki/Quartile
 */
export function getFasterQuartile(values: number[], q: 0.25 | 0.5 | 0.75): number {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;

  const medianIndex = Math.floor(n / 2);

  if (q === 0.25) {
    return getFasterMedian(sorted.slice(0, medianIndex));
  } else if (q === 0.75) {
    if (n % 2 === 0) {
      // Even number of items: the upper half is the last n/2 items
      return getFasterMedian(sorted.slice(medianIndex));
    }
    // Odd number of items: the upper half excludes the median
    return getFasterMedian(sorted.slice(medianIndex + 1));
  }
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base] + (sorted[base + 1] - sorted[base]) * rest;
}
