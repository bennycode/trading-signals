import {getLinearRegression} from './getLinearRegression.js';

describe('getLinearRegression', () => {
  it('fits a straight line and projects it one value ahead', () => {
    const values = [10, 11, 12, 13, 14] as const;

    const result = getLinearRegression(values);

    expect(result.slope).toBe(1);
    expect(result.intercept).toBe(10);
    expect(result.prediction).toBe(15);
  });

  it('rejects windows with fewer than 2 values', () => {
    expect(() => getLinearRegression([42])).toThrowError(
      'The linear regression has to be fitted over at least 2 values, but "1" was given.'
    );
    expect(() => getLinearRegression([])).toThrowError(
      'The linear regression has to be fitted over at least 2 values, but "0" was given.'
    );
  });
});
