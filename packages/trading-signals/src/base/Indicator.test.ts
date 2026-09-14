import {ATR} from '../volatility/ATR/ATR.js';
import {IndicatorInputShape, IndicatorSeries, assertInputShape} from './Indicator.js';
import {NotEnoughDataError} from '../error/NotEnoughDataError.js';

describe('Indicator', () => {
  class IndicatorTestClass extends IndicatorSeries {
    override readonly inputShape = IndicatorInputShape.PRICE;

    public readonly inputs: number[] = [];

    override getRequiredInputs() {
      return 2;
    }

    update(input: number, replace: boolean) {
      if (replace) {
        this.inputs.pop();
      }
      this.inputs.push(input);
      const sum = this.inputs.reduce((acc, current) => acc + current, 0);
      return this.setResult(sum / this.inputs.length, replace);
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
    it('sets and replaces the latest result correctly', () => {
      const itc = new IndicatorTestClass();

      itc.add(100);
      expect(itc.inputs.length).toBe(1);
      expect(itc.getResultOrThrow().toString()).toBe('100');

      itc.replace(200);
      expect(itc.inputs.length).toBe(1);
      expect(itc.getResultOrThrow().toString()).toBe('200');

      itc.replace(60);
      expect(itc.inputs.length).toBe(1);
      expect(itc.getResultOrThrow().toString()).toBe('60');

      itc.add(20);
      expect(itc.inputs.length).toBe(2);
      expect(itc.getResultOrThrow().toString()).toBe('40');

      // Replacing an update with itself should be a "noop"
      itc.replace(20);
      expect(itc.inputs.length).toBe(2);
      expect(itc.getResultOrThrow().toString()).toBe('40');

      itc.add(211);
      expect(itc.inputs.length).toBe(3);
      expect(itc.getResultOrThrow().toString()).toBe('97');

      // Replacing an update with itself should be a "noop"
      itc.replace(211);
      expect(itc.inputs.length).toBe(3);
      expect(itc.getResultOrThrow().toString()).toBe('97');
    });
  });

  describe('updates', () => {
    it('returns all results from multiple updates', () => {
      const itc = new IndicatorTestClass();
      const results = itc.updates([100, 1_000, 10_000]);
      expect(results.map(number => number?.toString())).toEqual(['100', '550', '3700']);
    });
  });
});

describe('inputShape', () => {
  /*
   * A price and a volume are the same type, so this one declaration is the only one the compiler
   * cannot derive. The sources say it a second way, in the name of the parameter the indicator
   * reads, and the two have to agree.
   */
  it('agrees with the parameter each indicator reads', async () => {
    const {readFileSync, readdirSync} = await import('node:fs');
    const {join} = await import('node:path');

    const files: string[] = [];
    const walk = (directory: string) => {
      for (const entry of readdirSync(directory, {withFileTypes: true})) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
          walk(path);
        } else if (entry.name.endsWith('.ts') && !entry.name.includes('.test.')) {
          files.push(path);
        }
      }
    };
    walk(join(import.meta.dirname, '..'));

    const disagreeing = files.filter(file => {
      const source = readFileSync(file, 'utf8');
      // A declaration, not a mention: this very file names both members while declaring neither.
      const declaresVolume = /inputShape = IndicatorInputShape\.VOLUME/.test(source);
      const declaresPrice = /inputShape = IndicatorInputShape\.PRICE/.test(source);
      const readsVolume = /\n  (?:override )?update\(volume\b/.test(source);
      return (declaresVolume && !readsVolume) || (declaresPrice && readsVolume);
    });

    expect(
      disagreeing,
      'an indicator reading a volume series declares VOLUME and names its parameter "volume"'
    ).toEqual([]);
  });
});

describe('assertInputShape', () => {
  it.each([
    {input: 5, label: 'a number where a candle belongs', message: 'reads high, low, close of a candle'},
    {input: {close: 2, high: 3}, label: 'a candle short of a field', message: 'reads "low"'},
    {input: null, label: 'nothing at all', message: 'reads high, low, close of a candle'},
  ])('refuses $label', ({input, message}) => {
    expect(
      () => assertInputShape(input, IndicatorInputShape.HIGH_LOW_CLOSE, 'ATR'),
      'an unchecked candle indicator reads undefined fields and answers NaN, which travels'
    ).toThrow(message);
  });

  it.each([
    {input: {close: 1}, label: 'an object', shape: IndicatorInputShape.PRICE},
    {input: '5', label: 'a string', shape: IndicatorInputShape.VOLUME},
  ])('refuses $label where a single number belongs', ({input, shape}) => {
    expect(() => assertInputShape(input, shape, 'SMA')).toThrow('reads a single');
  });

  it.each([
    {input: 5, shape: IndicatorInputShape.PRICE},
    {input: 5, shape: IndicatorInputShape.VOLUME},
    {input: {close: 1, high: 2, low: 0, open: 1, volume: 9}, shape: IndicatorInputShape.OPEN_HIGH_LOW_CLOSE_VOLUME},
    {input: {high: 2, low: 0}, shape: IndicatorInputShape.HIGH_LOW},
    {input: {close: 1, high: 2, low: 0, open: 1}, shape: IndicatorInputShape.OPEN_HIGH_LOW_CLOSE},
    {input: {close: 1, high: 2, low: 0, volume: 9}, shape: IndicatorInputShape.HIGH_LOW_CLOSE_VOLUME},
  ])('accepts what $shape asks for', ({input, shape}) => {
    expect(() => assertInputShape(input, shape)).not.toThrow();
  });

  it('names the indicator that was handed the wrong input', () => {
    expect(() => new ATR(14).add(5 as never), 'the message has to point at the call that caused it').toThrow(
      'ATR reads high, low, close'
    );
  });
});
