import {getTypicalPrice} from './getTypicalPrice.js';

describe('getTypicalPrice', () => {
  /*
   * Test data verified with:
   * https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/untest.txt#L434-L438
   */
  const candles = [
    {close: 81.59, high: 82.15, low: 81.29},
    {close: 81.06, high: 81.89, low: 80.64},
    {close: 82.87, high: 83.03, low: 81.31},
    {close: 83.0, high: 83.3, low: 82.65},
    {close: 83.61, high: 83.85, low: 83.07},
    {close: 83.15, high: 83.9, low: 83.11},
    {close: 82.84, high: 83.33, low: 82.49},
    {close: 83.99, high: 84.3, low: 82.3},
    {close: 84.55, high: 84.84, low: 84.15},
    {close: 84.36, high: 85.0, low: 84.11},
    {close: 85.53, high: 85.9, low: 84.03},
    {close: 86.54, high: 86.58, low: 85.39},
    {close: 86.89, high: 86.98, low: 85.76},
    {close: 87.77, high: 88.0, low: 87.17},
    {close: 87.29, high: 87.87, low: 87.01},
  ] as const;
  const expectations = [
    '81.677',
    '81.197',
    '82.403',
    '82.983',
    '83.510',
    '83.387',
    '82.887',
    '83.530',
    '84.513',
    '84.490',
    '85.153',
    '86.170',
    '86.543',
    '87.647',
    '87.390',
  ] as const;

  it('matches the reference implementation', {tags: ['tulipindicators']}, () => {
    candles.forEach((candle, i) => {
      expect(getTypicalPrice(candle).toFixed(3)).toBe(expectations[i]);
    });
  });

  it('keeps the bar range in the price', () => {
    const ranUpAndGaveItBack = getTypicalPrice({close: 100, high: 110, low: 100});
    const droppedAndRecovered = getTypicalPrice({close: 100, high: 100, low: 90});

    expect(ranUpAndGaveItBack.toFixed(2), 'sits above a close that ended at the low of the bar').toBe('103.33');
    expect(droppedAndRecovered.toFixed(2), 'sits below a close that ended at the high of the bar').toBe('96.67');
  });
});
