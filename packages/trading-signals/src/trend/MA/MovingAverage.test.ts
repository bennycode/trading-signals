import {TradingSignal} from '../../base/Indicator.js';
import {ALMA} from '../ALMA/ALMA.js';
import {DEMA} from '../DEMA/DEMA.js';
import {EMA} from '../EMA/EMA.js';
import {FRAMA} from '../FRAMA/FRAMA.js';
import {HMA} from '../HMA/HMA.js';
import {KAMA} from '../KAMA/KAMA.js';
import {McGinleyDynamic} from '../MD/McGinleyDynamic.js';
import {RMA} from '../RMA/RMA.js';
import {SMA} from '../SMA/SMA.js';
import {SMA15} from '../SMA15/SMA15.js';
import {SuperSmoother} from '../SUPERSMOOTHER/SuperSmoother.js';
import {T3} from '../T3/T3.js';
import {TEMA} from '../TEMA/TEMA.js';
import {TRIMA} from '../TRIMA/TRIMA.js';
import {VIDYA} from '../VIDYA/VIDYA.js';
import {WMA} from '../WMA/WMA.js';
import {WSMA} from '../WSMA/WSMA.js';
import {ZLEMA} from '../ZLEMA/ZLEMA.js';
import {MovingAverage} from './MovingAverage.js';

class MyAverage extends MovingAverage {
  iterations = 0;
  total = 0;

  override getRequiredInputs() {
    return this.interval;
  }

  update(price: number, replace: boolean) {
    this.iterations += 1;
    this.total += price;
    return this.setResult(this.total / this.iterations, replace);
  }
}

describe('MovingAverage', () => {
  it('can be used to implement custom average calculations based on primitive numbers', () => {
    const average = new MyAverage(Infinity);
    expect(average.isStable).toBe(false);
    expect(() => average.getResultOrThrow()).toThrowError();
    average.add(50);
    average.add(100);
    const result = average.getResultOrThrow();
    expect(result).toBe(75);
  });

  describe('getSignal', () => {
    it('gives custom averages the trend of their readings', () => {
      const average = new MyAverage(2);

      for (const price of [10, 20, 30]) {
        average.add(price);
      }

      expect(average.getSignal().state, 'the running mean of 20 is above the 10 it read two inputs earlier').toBe(
        TradingSignal.BULLISH
      );
    });

    it('compares the average of the latest interval with the average of the interval before it', () => {
      const sma = new SMA(3);

      for (const price of [10, 11, 12, 13, 14, 15]) {
        sma.add(price);
      }

      expect(sma.getSignal().state, 'SMA(13, 14, 15) of 14 is above SMA(10, 11, 12) of 11').toBe(TradingSignal.BULLISH);
    });

    it('returns UNKNOWN until two intervals have been averaged', () => {
      const sma = new SMA(3);

      for (const price of [10, 11, 12, 13, 14]) {
        sma.add(price);
      }

      expect(sma.isStable).toBe(true);
      expect(sma.getSignal().state, 'only the first three inputs have no predecessor yet').toBe(TradingSignal.UNKNOWN);
    });

    it('returns BEARISH when the latest average is lower', () => {
      const sma = new SMA(3);

      for (const price of [15, 14, 13, 12, 11, 10]) {
        sma.add(price);
      }

      expect(sma.getSignal().state).toBe(TradingSignal.BEARISH);
    });

    it('returns SIDEWAYS when the latest average is unchanged', () => {
      const sma = new SMA(3);

      for (const price of [10, 12, 14, 12, 14, 10]) {
        sma.add(price);
      }

      expect(sma.getSignal().state, 'both windows average 12').toBe(TradingSignal.SIDEWAYS);
    });

    it('reports when the direction changes', () => {
      const sma = new SMA(3);

      for (const price of [10, 11, 12, 13, 14, 15]) {
        sma.add(price);
      }

      expect(sma.getSignal().state).toBe(TradingSignal.BULLISH);

      sma.add(0);

      expect(sma.getSignal()).toEqual({hasChanged: true, state: TradingSignal.BEARISH});
    });

    it('follows a replaced input and restores the original direction', () => {
      const sma = new SMA(3);

      for (const price of [10, 11, 12, 13, 14]) {
        sma.add(price);
      }

      sma.add(15);

      expect(sma.getSignal().state).toBe(TradingSignal.BULLISH);

      sma.replace(0);

      expect(sma.getSignal().state, 'SMA(13, 14, 0) of 9 is below 11').toBe(TradingSignal.BEARISH);

      sma.replace(15);

      expect(sma.getSignal().state).toBe(TradingSignal.BULLISH);
    });

    it('ignores readings from the warm-up', () => {
      const ema = new EMA(3);

      for (const price of [1, 2, 3, 4, 5]) {
        ema.add(price);
      }

      expect(
        ema.getSignal().state,
        'five readings exist, but the first two are from the warm-up, so a comparison is one reading short'
      ).toBe(TradingSignal.UNKNOWN);

      ema.add(6);

      expect(ema.getSignal().state).toBe(TradingSignal.BULLISH);
    });

    it.each([
      ['ALMA', () => new ALMA(5)],
      ['DEMA', () => new DEMA(5)],
      ['EMA', () => new EMA(5)],
      ['FRAMA', () => new FRAMA(6)],
      ['HMA', () => new HMA(5)],
      ['KAMA', () => new KAMA(5)],
      ['McGinleyDynamic', () => new McGinleyDynamic(5)],
      ['RMA', () => new RMA(5)],
      ['SMA', () => new SMA(5)],
      ['SMA15', () => new SMA15(5)],
      ['SuperSmoother', () => new SuperSmoother(5)],
      ['T3', () => new T3(5)],
      ['TEMA', () => new TEMA(5)],
      ['TRIMA', () => new TRIMA(5)],
      ['VIDYA', () => new VIDYA(5)],
      ['WMA', () => new WMA(5)],
      ['WSMA', () => new WSMA(5)],
      ['ZLEMA', () => new ZLEMA(5)],
    ])('gives %s the trend of its average', (_name, create) => {
      const rising = create();
      const falling = create();

      for (let i = 1; i <= 100; i++) {
        rising.add(100 + i);
        falling.add(200 - i);
      }

      expect(rising.getSignal().state).toBe(TradingSignal.BULLISH);
      expect(falling.getSignal().state).toBe(TradingSignal.BEARISH);
    });
  });
});
