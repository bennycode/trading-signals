import {getTypicalPrice} from './getTypicalPrice.js';

describe('getTypicalPrice', () => {
  it('averages high, low and close', () => {
    expect(getTypicalPrice({close: 81.59, high: 82.15, low: 81.29}).toFixed(3)).toBe('81.677');
  });

  it('keeps the bar range in the price', () => {
    const ranUpAndGaveItBack = getTypicalPrice({close: 100, high: 110, low: 100});
    const droppedAndRecovered = getTypicalPrice({close: 100, high: 100, low: 90});

    expect(ranUpAndGaveItBack.toFixed(2), 'sits above a close that ended at the low of the bar').toBe('103.33');
    expect(droppedAndRecovered.toFixed(2), 'sits below a close that ended at the high of the bar').toBe('96.67');
  });
});
