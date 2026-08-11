import {getSharpeRatio} from './getSharpeRatio.js';

describe('getSharpeRatio', () => {
  it('divides the average return by the volatility of the returns', () => {
    const returns = [10, 20];

    expect(getSharpeRatio(returns)).toBe(3);
  });

  it('subtracts the risk-free rate from the average return before dividing by the volatility', () => {
    const returns = [10, 20];

    expect(getSharpeRatio(returns, 5)).toBe(2);
  });

  it('throws an error when the returns show no variance', () => {
    const returns = [5, 5];

    expect(() => getSharpeRatio(returns)).toThrowError(
      'Cannot calculate the Sharpe ratio of returns without variance.'
    );
  });
});
