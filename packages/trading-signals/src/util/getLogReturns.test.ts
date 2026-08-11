import {getLogReturns} from './getLogReturns.js';

describe('getLogReturns', () => {
  it('converts a price series into per-bar logarithmic returns', () => {
    const prices = [100, 200, 100] as const;
    const expected = [Math.log(2), Math.log(0.5)] as const;

    expect(getLogReturns([...prices])).toStrictEqual([...expected]);
  });

  it('throws when fewer than 2 values are given', () => {
    expect(() => getLogReturns([100])).toThrowError(
      'The log returns have to be taken over at least 2 values, but "1" was given.'
    );
  });

  it('throws when the previous value is non-positive', () => {
    expect(() => getLogReturns([-1, 100])).toThrowError(
      'The log returns need positive values, but "-1" and "100" were given.'
    );
  });

  it('throws when the current value is non-positive', () => {
    expect(() => getLogReturns([100, 0])).toThrowError(
      'The log returns need positive values, but "100" and "0" were given.'
    );
  });
});
