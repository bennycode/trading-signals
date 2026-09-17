import {INPUT_SHAPE_FIELDS, IndicatorInputShape, IndicatorSeries} from './Indicator.js';
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

describe('INPUT_SHAPE_FIELDS', () => {
  it.each([
    [IndicatorInputShape.HIGH_LOW, ['high', 'low']],
    [IndicatorInputShape.HIGH_LOW_CLOSE, ['high', 'low', 'close']],
    [IndicatorInputShape.HIGH_LOW_CLOSE_VOLUME, ['high', 'low', 'close', 'volume']],
    [IndicatorInputShape.OPEN_HIGH_LOW_CLOSE, ['open', 'high', 'low', 'close']],
    [IndicatorInputShape.OPEN_HIGH_LOW_CLOSE_VOLUME, ['open', 'high', 'low', 'close', 'volume']],
    [IndicatorInputShape.PRICE, []],
    [IndicatorInputShape.VOLUME, []],
  ])('lists the candle fields for %s', (shape, fields) => {
    expect(INPUT_SHAPE_FIELDS[shape]).toEqual(fields);
  });
});
