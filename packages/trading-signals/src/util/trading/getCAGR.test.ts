import {getCAGR} from './getCAGR.js';

describe('getCAGR', () => {
  it('calculates the constant yearly growth rate in percent', () => {
    expect(getCAGR(100, 121, 2).toFixed(2)).toBe('10.00');
  });

  it('calculates a negative growth rate when the end value is below the begin value', () => {
    expect(getCAGR(100, 50, 1)).toBe(-50);
  });

  it('throws an error when the begin value is not positive', () => {
    expect(() => getCAGR(0, 100, 1)).toThrowError(
      'The begin and end values have to be positive, but "0" and "100" were given.'
    );
  });

  it('throws an error when the end value is not positive', () => {
    expect(() => getCAGR(100, -50, 1)).toThrowError(
      'The begin and end values have to be positive, but "100" and "-50" were given.'
    );
  });

  it('throws an error when the years are not finite', () => {
    expect(() => getCAGR(100, 200, Number.POSITIVE_INFINITY)).toThrowError(
      'The years have to be a positive number, but "Infinity" was given.'
    );
  });

  it('throws an error when the years are not positive', () => {
    expect(() => getCAGR(100, 200, 0)).toThrowError('The years have to be a positive number, but "0" was given.');
  });
});
