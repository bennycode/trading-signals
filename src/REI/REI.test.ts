import {describe, expect, it} from 'vitest';
import {FasterREI, REI} from './REI.js';

describe('REI', () => {
  it('calculates the Range Expansion Index', () => {
    // Interval of 2
    const rei = new REI(2);

    // First candle - not enough data
    let result = rei.update(
      {
        close: 105,
        high: 110,
        low: 100,
      },
      false
    );
    expect(result).toBeNull();

    // Second candle - not enough data
    result = rei.update(
      {
        close: 115,
        high: 120,
        low: 105,
      },
      false
    );
    expect(result).toBeNull();

    // Third candle - now we can calculate REI
    // Candle ranges: 10, 15, 10
    // First two ranges average: (10+15)/2 = 12.5
    // Current range: 10
    // REI = (10/12.5)*100 = 80
    result = rei.update(
      {
        close: 120,
        high: 125,
        low: 115,
      },
      false
    );
    expect(result?.toNumber()).toBe(80);

    // Fourth candle - range expanded
    // Candle ranges: 15, 10, 30
    // First two ranges average: (15+10)/2 = 12.5
    // Current range: 30
    // REI = (30/12.5)*100 = 240
    result = rei.update(
      {
        close: 140,
        high: 150,
        low: 120,
      },
      false
    );
    expect(result?.toNumber()).toBe(240);
  });

  it('handles replace correctly', () => {
    const rei = new REI(2);
    const fasterREI = new FasterREI(2);

    const firstCandle = {close: 105, high: 110, low: 100};
    const secondCandle = {close: 115, high: 120, low: 105};
    const thirdCandle = {close: 120, high: 125, low: 115};
    const replacement = {close: 125, high: 135, low: 115};

    const initialExpectation = 80;
    const replacedExpectation = 160;

    // Add 3 candles to get an initial REI value
    rei.add(firstCandle);
    rei.add(secondCandle);
    const initial = rei.add(thirdCandle);

    fasterREI.add(firstCandle);
    fasterREI.add(secondCandle);
    const fasterInitial = fasterREI.add(thirdCandle);

    expect(initial?.toNumber()).toBe(initialExpectation);
    expect(fasterInitial).toBe(initialExpectation);

    // Replace the last candle with different values
    // Original candle ranges: 10, 15, 10
    // First two ranges average: (10+15)/2 = 12.5
    // New current range: 20
    // REI = (20/12.5)*100 = 160
    const replaced = rei.replace(replacement);
    const fasterReplaced = fasterREI.replace(replacement);

    expect(replaced?.toNumber()).toBe(replacedExpectation);
    expect(fasterReplaced).toBe(replacedExpectation);

    // Revert
    expect(rei.replace(thirdCandle)?.toNumber()).toBe(initialExpectation);
    expect(fasterREI.replace(thirdCandle)).toBe(initialExpectation);
  });

  it('maintains highest and lowest REI values', () => {
    const rei = new REI(2);

    // Add enough candles to get REI values
    rei.update({close: 105, high: 110, low: 100}, false);
    rei.update({close: 115, high: 120, low: 105}, false);
    rei.update({close: 120, high: 125, low: 115}, false);

    // Add a candle that will generate a higher REI
    rei.update({close: 140, high: 150, low: 120}, false);

    // Add a candle that will generate a lower REI
    rei.update({close: 122, high: 125, low: 120}, false);

    expect(rei.highest?.toNumber()).toBeGreaterThan(80);
    expect(rei.lowest?.toNumber()).toBeLessThan(80);
  });
});

describe('FasterREI', () => {
  it('calculates the Range Expansion Index using primitive numbers', () => {
    // Interval of 2
    const rei = new FasterREI(2);

    // First candle - not enough data
    let result = rei.update(
      {
        close: 105,
        high: 110,
        low: 100,
      },
      false
    );
    expect(result).toBeNull();

    // Second candle - not enough data
    result = rei.update(
      {
        close: 115,
        high: 120,
        low: 105,
      },
      false
    );
    expect(result).toBeNull();

    // Third candle - now we can calculate REI
    // Candle ranges: 10, 15, 10
    // First two ranges average: (10+15)/2 = 12.5
    // Current range: 10
    // REI = (10/12.5)*100 = 80
    result = rei.update(
      {
        close: 120,
        high: 125,
        low: 115,
      },
      false
    );
    expect(result).toBe(80);

    // Fourth candle - range expanded
    // Candle ranges: 15, 10, 30
    // First two ranges average: (15+10)/2 = 12.5
    // Current range: 30
    // REI = (30/12.5)*100 = 240
    result = rei.update(
      {
        close: 140,
        high: 150,
        low: 120,
      },
      false
    );
    expect(result).toBe(240);
  });
});
