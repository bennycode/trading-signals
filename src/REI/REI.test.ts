import {FasterREI, REI} from './REI.js';
import {Big} from '../index.js';
import {expect, it, describe} from 'vitest';

describe('REI', () => {
  it('calculates the Range Expansion Index', () => {
    // Interval of 2
    const rei = new REI(2);

    // First candle - not enough data
    let result = rei.update({
      high: 110,
      low: 100,
      close: 105,
    }, false);
    expect(result).toBeNull();

    // Second candle - not enough data
    result = rei.update({
      high: 120,
      low: 105,
      close: 115,
    }, false);
    expect(result).toBeNull();

    // Third candle - now we can calculate REI
    // Candle ranges: 10, 15, 10
    // First two ranges average: (10+15)/2 = 12.5
    // Current range: 10
    // REI = (10/12.5)*100 = 80
    result = rei.update({
      high: 125,
      low: 115,
      close: 120,
    }, false);
    expect(result?.toNumber()).toBe(80);

    // Fourth candle - range expanded
    // Candle ranges: 15, 10, 30
    // First two ranges average: (15+10)/2 = 12.5
    // Current range: 30
    // REI = (30/12.5)*100 = 240
    result = rei.update({
      high: 150,
      low: 120,
      close: 140,
    }, false);
    expect(result?.toNumber()).toBe(240);
  });

  it('handles replace correctly', () => {
    const rei = new REI(2);

    // Add 3 candles to get an initial REI value
    rei.update({high: 110, low: 100, close: 105}, false);
    rei.update({high: 120, low: 105, close: 115}, false);
    const initial = rei.update({high: 125, low: 115, close: 120}, false);
    
    // Replace the last candle with different values
    // Original candle ranges: 10, 15, 10
    // First two ranges average: (10+15)/2 = 12.5
    // New current range: 20
    // REI = (20/12.5)*100 = 160
    const replaced = rei.update({high: 135, low: 115, close: 125}, true);
    
    expect(initial?.toNumber()).toBe(80);
    expect(replaced?.toNumber()).toBe(160);
  });

  it('maintains highest and lowest REI values', () => {
    const rei = new REI(2);
    
    // Add enough candles to get REI values
    rei.update({high: 110, low: 100, close: 105}, false);
    rei.update({high: 120, low: 105, close: 115}, false);
    rei.update({high: 125, low: 115, close: 120}, false);
    
    // Add a candle that will generate a higher REI
    rei.update({high: 150, low: 120, close: 140}, false);
    
    // Add a candle that will generate a lower REI
    rei.update({high: 125, low: 120, close: 122}, false);
    
    expect(rei.highest?.toNumber()).toBeGreaterThan(80);
    expect(rei.lowest?.toNumber()).toBeLessThan(80);
  });
});

describe('FasterREI', () => {
  it('calculates the Range Expansion Index using primitive numbers', () => {
    // Interval of 2
    const rei = new FasterREI(2);

    // First candle - not enough data
    let result = rei.update({
      high: 110,
      low: 100,
      close: 105,
    }, false);
    expect(result).toBeNull();

    // Second candle - not enough data
    result = rei.update({
      high: 120,
      low: 105,
      close: 115,
    }, false);
    expect(result).toBeNull();

    // Third candle - now we can calculate REI
    // Candle ranges: 10, 15, 10
    // First two ranges average: (10+15)/2 = 12.5
    // Current range: 10
    // REI = (10/12.5)*100 = 80
    result = rei.update({
      high: 125,
      low: 115,
      close: 120,
    }, false);
    expect(result).toBe(80);

    // Fourth candle - range expanded
    // Candle ranges: 15, 10, 30
    // First two ranges average: (15+10)/2 = 12.5
    // Current range: 30
    // REI = (30/12.5)*100 = 240
    result = rei.update({
      high: 150,
      low: 120,
      close: 140,
    }, false);
    expect(result).toBe(240);
  });
});