import {Big, type BigSource} from 'big.js';
import {BigIndicatorSeries} from './Indicator.js';
import {NotEnoughDataError} from './error/NotEnoughDataError.js';

describe('Indicator', () => {
  class IndicatorTestClass extends BigIndicatorSeries {
    public readonly inputs: Big[] = [];

    override getRequiredInputs() {
      return 2;
    }

    update(input: BigSource, replace: boolean) {
      if (replace) {
        this.inputs.pop();
      }
      this.inputs.push(new Big(input));
      const sum = this.inputs.reduce((acc, current) => acc.plus(current), new Big(0));
      return this.setResult(sum.div(this.inputs.length), replace);
    }
  }

  describe('getRequiredInputs', () => {
    it('returns the amount of required data needed for a calculation', () => {
      const itc = new IndicatorTestClass();
      expect(itc.getRequiredInputs()).toBe(2);
    });
  });

  describe('isStable', () => {
    it('is unstable when no values are entered', () => {
      const itc = new IndicatorTestClass();
      expect(itc.isStable).toBe(false);
      itc.add(1);
      expect(itc.isStable).toBe(true);
    });
  });

  describe('getResult', () => {
    it('returns the result if an indicator is stable', () => {
      const itc = new IndicatorTestClass();
      itc.add(1);
      expect(itc.getResult()?.toFixed()).toBe('1');
    });

    it("returns null if an indicator isn't stable", () => {
      const itc = new IndicatorTestClass();
      expect(itc.getResult()).toBe(null);
    });
  });

  describe('getResultOrThrow', () => {
    it('throws an error when there is not enough input data', () => {
      const itc = new IndicatorTestClass();
      try {
        itc.getResultOrThrow();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });

    it('returns the cross sum', () => {
      const itc = new IndicatorTestClass();
      itc.updates([20, 40], false);
      expect(itc.getResultOrThrow().toString()).toBe('30');
    });
  });

  describe('setResult', () => {
    it('implicitly sets the highest and lowest values', () => {
      const itc = new IndicatorTestClass();
      expect(itc.lowest).toBeUndefined();
      expect(itc.highest).toBeUndefined();

      itc.add(100);
      expect(itc.inputs.length).toBe(1);
      expect(itc.getResultOrThrow().toString()).toBe('100');
      expect(itc.lowest?.toString()).toBe('100');
      expect(itc.highest?.toString()).toBe('100');

      itc.replace(200);
      expect(itc.inputs.length).toBe(1);
      expect(itc.getResultOrThrow().toString()).toBe('200');
      expect(itc.lowest?.toString()).toBe('200');
      expect(itc.highest?.toString()).toBe('200');

      itc.replace(60);
      expect(itc.inputs.length).toBe(1);
      expect(itc.getResultOrThrow().toString()).toBe('60');
      expect(itc.lowest?.toString()).toBe('60');
      expect(itc.highest?.toString()).toBe('60');

      itc.add(20);
      expect(itc.inputs.length).toBe(2);
      expect(itc.getResultOrThrow().toString()).toBe('40');
      expect(itc.lowest?.toString(), 'lowest cross sum seen (60+20/2)').toBe('40');
      expect(itc.highest?.toString(), 'highest cross sum seen (60/1)').toBe('60');

      // Replacing an update with itself should be a "noop"
      itc.replace(20);
      expect(itc.inputs.length).toBe(2);
      expect(itc.getResultOrThrow().toString()).toBe('40');
      expect(itc.lowest?.toString(), 'lowest cross sum seen (60+20/2)').toBe('40');
      expect(itc.highest?.toString(), 'highest cross sum seen (60/1)').toBe('60');

      itc.add(211);
      expect(itc.inputs.length).toBe(3);
      expect(itc.getResultOrThrow().toString()).toBe('97');
      expect(itc.lowest?.toString()).toBe('40');
      expect(itc.highest?.toString()).toBe('97');

      // Replacing an update with itself should be a "noop"
      itc.replace(211);
      expect(itc.inputs.length).toBe(3);
      expect(itc.getResultOrThrow().toString()).toBe('97');
      expect(itc.lowest?.toString()).toBe('40');
      expect(itc.highest?.toString()).toBe('97');
    });
  });

  describe('updates', () => {
    it('returns all results from multiple updates', () => {
      const itc = new IndicatorTestClass();
      const results = itc.updates([100, 1_000, 10_000]);
      expect(results.map(big => big?.toString())).toEqual(['100', '550', '3700']);
    });
  });
});
