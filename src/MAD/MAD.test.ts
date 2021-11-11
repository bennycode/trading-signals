import {FasterMAD, MAD} from './MAD';

describe('MAD', () => {
  // Test data verified with:
  // https://tulipindicators.org/md
  const prices = [
    81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29,
  ];

  it('calculates the absolute deviation from the mean over a period', () => {
    const prices = [2, 2, 3, 4, 14];
    const mad = new MAD(5);
    const fasterMAD = new FasterMAD(5);
    for (const price of prices) {
      mad.update(price);
      fasterMAD.update(price);
    }
    const actual = mad.getResult().valueOf();
    expect(actual).toBe('3.6');
    expect(fasterMAD.getResult().valueOf()).toBe(3.6);
  });

  it('is compatible with results from Tulip Indicators (TI)', () => {
    const mad = new MAD(5);
    const fasterMAD = new FasterMAD(5);
    for (const price of prices) {
      mad.update(price);
      fasterMAD.update(price);
    }
    expect(mad.getResult().toFixed(2)).toBe('0.62');
    expect(fasterMAD.getResult().toFixed(2)).toBe('0.62');
  });
});
