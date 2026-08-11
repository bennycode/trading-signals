import {getReturns} from './getReturns.js';

describe('getReturns', () => {
  it('converts a price series into per-bar returns in percent', () => {
    const prices = [100, 125, 100] as const;
    const expected = [25, -20] as const;

    expect(getReturns([...prices])).toStrictEqual([...expected]);
  });

  it('throws when fewer than 2 values are given', () => {
    expect(() => getReturns([100])).toThrowError(
      'The returns have to be taken over at least 2 values, but "1" was given.'
    );
  });

  it('throws when a value of 0 makes a return undefined', () => {
    expect(() => getReturns([0, 100])).toThrowError('Cannot calculate percentage change from a base value of "0".');
  });
});
