import {getAverage} from './getAverage.js';
import {getStandardDeviation} from './getStandardDeviation.js';

/**
 * Reward earned per unit of risk taken: the average excess return divided by the volatility of the
 * returns. Computed per period of the given returns — multiply by the square root of the number of
 * periods per year to annualize. The risk-free rate has to be expressed per period as well.
 *
 * @throws If the returns show no variance, because reward per unit of risk is undefined without risk.
 */
export function getSharpeRatio(returns: number[], riskFreeRate: number = 0) {
  const standardDeviation = getStandardDeviation(returns);

  if (standardDeviation === 0) {
    throw new Error('Cannot calculate the Sharpe ratio of returns without variance.');
  }

  return (getAverage(returns) - riskFreeRate) / standardDeviation;
}
