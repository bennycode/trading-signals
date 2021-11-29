import {StochasticRSI} from './StochasticRSI';

fdescribe('StochasticRSI', () => {
  describe('getResult', () => {
    it('calculates the Stochastic RSI', () => {
      const prices = [
        81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29,
      ];

      const stochRSI = new StochasticRSI(5);

      for (const price of prices) {
        const result = stochRSI.update(price);
        if (stochRSI.isStable) {
          console.info('res', result!.valueOf());
        }
      }
    });
  });
});
