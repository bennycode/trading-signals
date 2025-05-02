import type {BigSource} from 'big.js';
import Big from 'big.js';
import {BigIndicatorSeries, NumberIndicatorSeries} from '../Indicator.js';

/**
 * Interquartile Range (IQR)
 * Type: Volatility
 *
 * The IQR is the difference between the 75th percentile (Q3) and the 25th percentile (Q1) of a data set.
 * It is a measure of statistical dispersion and is robust to outliers.
 *
 * @see https://en.wikipedia.org/wiki/Interquartile_range
 */
export class IQR extends BigIndicatorSeries<Big> {
  private readonly values: Big[] = [];

  constructor(public readonly interval: number) {
    super();
  }

  private calculateQuartile(sorted: Big[], quartile: 0.25 | 0.75): Big {
    const n = sorted.length;

    // Find the median index
    const medianIndex = Math.floor(n / 2);

    if (quartile === 0.25) {
      // Q1 calculation
      if (n % 2 === 0) {
        // Even number of items: the lower half is the first n/2 items
        return medianOfBig(sorted.slice(0, medianIndex));
      }
      // Odd number of items: the lower half excludes the median
      return medianOfBig(sorted.slice(0, medianIndex));
    } else if (quartile === 0.75) {
      // Q3 calculation
      if (n % 2 === 0) {
        // Even number of items: the upper half is the last n/2 items
        return medianOfBig(sorted.slice(medianIndex));
      }
      // Odd number of items: the upper half excludes the median
      return medianOfBig(sorted.slice(medianIndex + 1));
    }

    // Fallback to standard quantile calculation for non-quartile values
    const pos = (sorted.length - 1) * quartile;
    const base = Math.floor(pos);
    const rest = pos - base;

    if (sorted[base + 1] !== undefined) {
      return sorted[base].plus(sorted[base + 1].minus(sorted[base]).times(rest));
    }
    return sorted[base];
  }

  update(value: BigSource, replace: boolean): Big | null {
    const bigValue = new Big(value);

    if (replace) {
      this.values.pop();
    }

    this.values.push(bigValue);

    if (this.values.length > this.interval) {
      this.values.shift();
    }

    if (this.values.length < this.interval) {
      return null;
    }

    // Sort a copy for quartile calculation
    const sorted = [...this.values].sort((a, b) => a.cmp(b));

    const q1 = this.calculateQuartile(sorted, 0.25);
    const q3 = this.calculateQuartile(sorted, 0.75);

    return this.setResult(q3.minus(q1), replace);
  }
}

/**
 * Calculate the median of an array of Big values
 */
function medianOfBig(values: Big[]): Big {
  const n = values.length;

  if (n === 0) {
    throw new Error('Cannot calculate median of empty array');
  }

  // For even number of items, take the average of the two middle items
  if (n % 2 === 0) {
    return values[n / 2 - 1].plus(values[n / 2]).div(2);
  }

  // For odd number of items, return the middle item
  return values[Math.floor(n / 2)];
}

export class FasterIQR extends NumberIndicatorSeries<number> {
  private readonly values: number[] = [];

  constructor(public readonly interval: number) {
    super();
  }

  update(value: number, replace: boolean): number | null {
    if (replace) {
      this.values.pop();
    }

    this.values.push(value);

    if (this.values.length > this.interval) {
      this.values.shift();
    }

    if (this.values.length < this.interval) {
      return null;
    }

    const sorted = [...this.values].sort((a, b) => a - b);

    const q1 = quartileNumberWikipedia(sorted, 0.25);
    const q3 = quartileNumberWikipedia(sorted, 0.75);

    return this.setResult(q3 - q1, replace);
  }
}

/**
 * Calculate a quartile using the Wikipedia method for number arrays
 */
function quartileNumberWikipedia(sorted: number[], q: number): number {
  const n = sorted.length;

  // Find the median index
  const medianIndex = Math.floor(n / 2);

  if (q === 0.25) {
    // Q1 calculation
    if (n % 2 === 0) {
      // Even number of items: the lower half is the first n/2 items
      return medianOfNumber(sorted.slice(0, medianIndex));
    }
    // Odd number of items: the lower half excludes the median
    return medianOfNumber(sorted.slice(0, medianIndex));
  } else if (q === 0.75) {
    // Q3 calculation
    if (n % 2 === 0) {
      // Even number of items: the upper half is the last n/2 items
      return medianOfNumber(sorted.slice(medianIndex));
    }
    // Odd number of items: the upper half excludes the median
    return medianOfNumber(sorted.slice(medianIndex + 1));
  }

  // Fallback to standard quantile calculation for non-quartile values
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;

  if (sorted[base + 1] !== undefined) {
    return sorted[base] + (sorted[base + 1] - sorted[base]) * rest;
  }
  return sorted[base];
}

/**
 * Calculate the median of an array of numbers
 */
function medianOfNumber(values: number[]): number {
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
