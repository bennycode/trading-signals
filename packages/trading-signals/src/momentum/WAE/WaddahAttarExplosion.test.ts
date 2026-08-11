import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {WaddahAttarExplosion} from './WaddahAttarExplosion.js';
import {TradingSignal} from '../../base/index.js';

/*
 * Formulation pinned to "Waddah Attar Explosion V2 [SHK]" by shayankm on TradingView
 * (https://www.tradingview.com/script/d9IjcYyS-Waddah-Attar-Explosion-V2-SHK/), a port of LazyBear's
 * WAE_LB with an ATR-based dead zone:
 *
 *   trend     = (macd - macd[1 bar ago]) * sensitivity, with macd = EMA(short, close) - EMA(long, close)
 *   explosion = upper - lower Bollinger Band (SMA basis, population standard deviation)
 *   deadZone  = RMA(TrueRange, atrInterval) * deadZoneMultiplier
 *
 * The worksheet below shrinks the SHK lookbacks so that every step stays an exact binary fraction:
 * the EMA weights become 1/2 (interval 3) and 1/4 (interval 7), and every candle spans
 * high = close + 2 / low = close - 2 while consecutive closes never move more than 2, which locks
 * every True Range at 4, the ATR at 4 and the dead zone at 4 * 0.5 = 2.
 *
 * | Bar | Close | EMA(3) | EMA(7)                     | MACD     | Trend = ΔMACD * 10 | Explosion = BB(2, 2) width |
 * | --- | ----- | ------ | -------------------------- | -------- | ------------------ | -------------------------- |
 * | 1-7 | 100   | 100    | 100                        | 0        | -                  | 0                          |
 * | 8   | 102   | 101    | 100.5 = 201/2              | 1/2      | 5                  | 4                          |
 * | 9   | 101   | 101    | 100.625 = 805/8            | 3/8      | -5/4 = -1.25       | 2                          |
 * | 10  | 99    | 100    | 100.21875 = 3207/32        | -7/32    | -95/16 = -5.9375   | 4                          |
 * | 11  | 99    | 99.5   | 99.9140625 = 12789/128     | -53/128  | -125/64 = -1.953125| 0                          |
 * | 12  | 99    | 99.25  | 99.685546875 = 51039/512   | -223/512 | -55/256 = -0.21484375 | 0                       |
 *
 * MACD and BB emit earlier than the full indicator, but the first complete reading needs the slow
 * EMA plus one candle (8), so bar 8 is the first result. Bar 9 is the guard case: its explosion (2)
 * lands exactly on the dead zone (2), and matching the noise floor is not enough — only exceeding it
 * counts as an explosion.
 */
const worksheetConfig = {
  atrInterval: 3,
  bandsInterval: 2,
  bandsMultiplier: 2,
  deadZoneMultiplier: 0.5,
  longInterval: 7,
  sensitivity: 10,
  shortInterval: 3,
} as const;

const worksheetCandles = [
  {close: 100, high: 102, low: 98},
  {close: 100, high: 102, low: 98},
  {close: 100, high: 102, low: 98},
  {close: 100, high: 102, low: 98},
  {close: 100, high: 102, low: 98},
  {close: 100, high: 102, low: 98},
  {close: 100, high: 102, low: 98},
  {close: 102, high: 104, low: 100},
  {close: 101, high: 103, low: 99},
  {close: 99, high: 101, low: 97},
  {close: 99, high: 101, low: 97},
  {close: 99, high: 101, low: 97},
] as const;

/*
 * Two averages with the same lookback stay identical forever, so their spread and with it the trend
 * is exactly zero on every bar — while the closes jump far enough for the volatility channel to open
 * way above the noise floor.
 */
const flatTrendConfig = {
  atrInterval: 2,
  bandsInterval: 4,
  bandsMultiplier: 2,
  deadZoneMultiplier: 0.5,
  longInterval: 2,
  sensitivity: 10,
  shortInterval: 2,
} as const;

function createWorksheetIndicator(bars: number) {
  const wae = new WaddahAttarExplosion(worksheetConfig);

  for (const candle of worksheetCandles.slice(0, bars)) {
    wae.add(candle);
  }

  return wae;
}

describe('WaddahAttarExplosion', () => {
  describe('update', () => {
    it('matches the hand-derived worksheet of the pinned SHK formulation', () => {
      const expectations = [
        {deadZone: 2, explosion: 4, trend: 5},
        {deadZone: 2, explosion: 2, trend: -1.25},
        {deadZone: 2, explosion: 4, trend: -5.9375},
        {deadZone: 2, explosion: 0, trend: -1.953125},
        {deadZone: 2, explosion: 0, trend: -0.21484375},
      ] as const;
      const wae = new WaddahAttarExplosion(worksheetConfig);
      const offset = wae.getRequiredInputs() - 1;
      let verifiedBars = 0;

      worksheetCandles.forEach((candle, i) => {
        const result = wae.add(candle);

        if (result) {
          verifiedBars++;
          expect(result).toEqual(expectations[i - offset]);
        }
      });

      expect(verifiedBars).toBe(expectations.length);
      expect(wae.isStable).toBe(true);
    });

    it('produces no result while the dead zone average is still warming up', () => {
      const wae = new WaddahAttarExplosion();

      for (let i = 1; i < 100; i++) {
        const result = wae.add({close: 100 + (i % 5), high: 101 + (i % 5), low: 99 + (i % 5)});

        expect(result).toBeNull();
      }

      expect(wae.isStable).toBe(false);
      expect(wae.add({close: 100, high: 101, low: 99})).not.toBeNull();
      expect(wae.isStable).toBe(true);
    });
  });

  describe('getRequiredInputs', () => {
    it('defaults to the 100-candle dead zone lookback of the pinned SHK formulation', () => {
      expect(new WaddahAttarExplosion().getRequiredInputs()).toBe(100);
    });

    it('is driven by the slowest component', () => {
      // The trend needs one candle more than its slow average (7 + 1)
      expect(new WaddahAttarExplosion(worksheetConfig).getRequiredInputs()).toBe(8);
      // The volatility channel (4) outlasts both the trend (2 + 1) and the dead zone (2)
      expect(new WaddahAttarExplosion(flatTrendConfig).getRequiredInputs()).toBe(4);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added value', () => {
      /*
       * Replacing the last worksheet candle with a close of 101 rewinds the trend base to bar 11
       * (MACD -53/128): the fast EMA becomes (101 + 99.5) / 2 = 100.25, the slow EMA becomes
       * 101/4 + 99.9140625 * 3/4 = 51295/512, so the MACD is 33/512 and the trend is
       * (33/512 + 53/128) * 10 = 1225/256 = 4.78515625. The Bollinger window {99, 101} opens the
       * explosion to 4, and the True Range stays locked at 4, keeping the dead zone at 2.
       */
      const wae = createWorksheetIndicator(11);
      const originalCandle = {close: 99, high: 101, low: 97} as const;
      const replacementCandle = {close: 101, high: 103, low: 99} as const;

      const originalResult = wae.add(originalCandle);

      expect(originalResult).toEqual({deadZone: 2, explosion: 0, trend: -0.21484375});

      const replacedResult = wae.replace(replacementCandle);

      expect(replacedResult).toEqual({deadZone: 2, explosion: 4, trend: 4.78515625});

      const restoredResult = wae.replace(originalCandle);

      expect(restoredResult).toEqual({deadZone: 2, explosion: 0, trend: -0.21484375});
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN before the warm-up is complete', () => {
      const wae = createWorksheetIndicator(7);

      expect(wae.getSignal()).toEqual({hasChanged: false, state: TradingSignal.UNKNOWN});
    });

    it('returns BULLISH when the explosion exceeds the dead zone and the trend pushes up', () => {
      const wae = createWorksheetIndicator(8);

      expect(wae.getResultOrThrow()).toEqual({deadZone: 2, explosion: 4, trend: 5});
      expect(wae.getSignal()).toEqual({hasChanged: true, state: TradingSignal.BULLISH});
    });

    it('returns BEARISH when the explosion exceeds the dead zone and the trend pushes down', () => {
      const wae = createWorksheetIndicator(10);

      expect(wae.getResultOrThrow()).toEqual({deadZone: 2, explosion: 4, trend: -5.9375});
      expect(wae.getSignal()).toEqual({hasChanged: true, state: TradingSignal.BEARISH});
    });

    it('returns SIDEWAYS when the explosion only matches the dead zone instead of exceeding it', () => {
      const wae = createWorksheetIndicator(9);

      expect(wae.getResultOrThrow()).toEqual({deadZone: 2, explosion: 2, trend: -1.25});
      expect(wae.getSignal()).toEqual({hasChanged: true, state: TradingSignal.SIDEWAYS});
    });

    it('keeps a flat trend sideways even when volatility explodes', () => {
      const wae = new WaddahAttarExplosion(flatTrendConfig);

      for (const close of [100, 200, 300, 400]) {
        wae.add({close, high: close + 1, low: close - 1});
      }

      const result = wae.getResultOrThrow();

      expect(result.trend).toBe(0);
      expect(result.explosion).toBeGreaterThan(result.deadZone);
      expect(wae.getSignal().state).toBe(TradingSignal.SIDEWAYS);
    });

    it('flags a change only when the signal switches its state', () => {
      const wae = createWorksheetIndicator(10);

      expect(wae.getSignal()).toEqual({hasChanged: true, state: TradingSignal.BEARISH});

      wae.add(worksheetCandles[10]);

      expect(wae.getSignal()).toEqual({hasChanged: true, state: TradingSignal.SIDEWAYS});

      wae.add(worksheetCandles[11]);

      expect(wae.getSignal()).toEqual({hasChanged: false, state: TradingSignal.SIDEWAYS});
    });
  });
});

testIndicatorContract({
  create: () => new WaddahAttarExplosion(worksheetConfig),
  divergentInput: {close: 1_000, high: 1_002, low: 998},
  inputs: worksheetCandles,
});
