import {Big, SMA} from './index.js';

describe('API Contract', () => {
  describe('README', () => {
    it('ensures that the README example is working', () => {
      const sma = new SMA(3);

      // You can add values individually:
      sma.add(40);
      sma.add(30);
      sma.add(20);

      // You can add multiple values at once:
      sma.updates([20, 40, 80]);

      // You can add stringified values:
      sma.add('10');

      // You can replace a previous value (useful for live charting):
      sma.replace('40');

      // You can add arbitrary-precision decimals:
      sma.add(new Big(30.0009));

      // You can check if an indicator is stable:
      expect(sma.isStable).toBe(true);

      // If an indicator is stable, you can get its result:
      expect(sma.getResult()?.toFixed()).toBe('50.0003');

      // You can also get the result without optional chaining:
      expect(sma.getResultOrThrow().toFixed()).toBe('50.0003');

      // Various precisions are available too:
      expect(sma.getResultOrThrow().toFixed(2)).toBe('50.00');
      expect(sma.getResultOrThrow().toFixed(4)).toBe('50.0003');

      // Each indicator also includes convenient features such as "lowest" and "highest" lifetime values:
      expect(sma.lowest?.toFixed(2)).toBe('23.33');
      expect(sma.highest?.toFixed(2)).toBe('53.33');
    });
  });
});
