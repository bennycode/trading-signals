import {Big} from 'big.js';
import {ms} from 'ms';
import {describe, expect, it, vi} from 'vitest';
import LTC_USDT_2d_1m_1606066988989 from '../../fixtures/StopLossStrategy/LTC_USDT_2d_1m_1606066988989.json' with {type: 'json'};
import OneWeekInMinutes from '../../fixtures/candles/OneWeekInMinutes.json' with {type: 'json'};
import TenMinutesInEightCandles from '../../fixtures/candles/TenMinutesInEightCandles.json' with {type: 'json'};
import TenMinutesInTenCandles from '../../fixtures/candles/TenMinutesInTenCandles.json' with {type: 'json'};
import TenMinutesMissingEnd from '../../fixtures/candles/TenMinutesMissingEnd.json' with {type: 'json'};
import TenMinutesMissingStart from '../../fixtures/candles/TenMinutesMissingStart.json' with {type: 'json'};
import hours from '../../fixtures/candles/batch/1h-in-1h.json' with {type: 'json'};
import minutes from '../../fixtures/candles/batch/1h-in-1m.json' with {type: 'json'};
import one_day_in_minutes from '../../fixtures/candles/candle-batcher/one_day_in_minutes.json' with {type: 'json'};
import one_hour_in_minutes from '../../fixtures/candles/candle-batcher/one_hour_in_minutes.json' with {type: 'json'};
import {BatchedCandle} from './BatchedCandle.js';
import {CandleBatcher} from './CandleBatcher.js';
import {ExchangeCandle} from '../core/Exchange.js';

describe('CandleBatcher', () => {
  describe('amountOfCandles', () => {
    it('knows how many candles are required to build up a timespan', () => {
      const amount = CandleBatcher.amountOfCandles('1h', '1d');
      expect(amount).toBe(24);
    });
  });

  describe('addToBatch', () => {
    it('returns a batched candle if enough candles have been added', () => {
      const expected = hours[0];
      const cb = new CandleBatcher(ms('1h'));
      let actual: BatchedCandle | undefined;

      for (const candle of minutes) {
        actual = cb.addToBatch(candle);
      }

      assert.exists(actual);

      // Pair
      expect(expected.base).toBe(actual.base);
      expect(expected.counter).toBe(actual.counter);

      // Open-high-low-close chart
      expect(new Big(expected.open).eq(actual.open)).toBe(true);
      expect(new Big(expected.high).eq(actual.high)).toBe(true);
      expect(new Big(expected.low).eq(actual.low)).toBe(true);
      expect(new Big(expected.close).eq(actual.close)).toBe(true);

      // Meta
      expect(expected.openTimeInISO).toBe(actual.openTimeInISO);
      expect(expected.openTimeInMillis).toBe(actual.openTimeInMillis);
      expect(expected.sizeInMillis).toBe(actual.sizeInMillis);
      expect(new Big(expected.volume).eq(actual.volume)).toBe(true);
    });

    it('batches a day of candles from minutes to hours', () => {
      const cb = new CandleBatcher(ms('1h'));
      const dayInHours = [];

      one_day_in_minutes.forEach(candle => {
        const batch = cb.addToBatch(candle);
        if (batch) {
          dayInHours.push(batch);
        }
      });

      // One day has 1440 minutes
      expect(one_day_in_minutes.length).toBe(1440);
      // One day has 24 hours
      expect(dayInHours.length).toBe(24);
    });

    it('batches two days of candles from minutes to hours', () => {
      const cb = new CandleBatcher(ms('1h'));
      const daysInHours = [];

      LTC_USDT_2d_1m_1606066988989.forEach(candle => {
        const batch = cb.addToBatch(candle);
        if (batch) {
          daysInHours.push(batch);
        }
      });

      // Two days have 2880 minutes
      expect(LTC_USDT_2d_1m_1606066988989.length).toBe(2880);
      // Two days have 48 hours
      expect(daysInHours.length).toBe(48);
    });

    it('does not batch candles with zero volume', () => {
      const candles: ExchangeCandle[] = [
        {
          base: 'BTC',
          close: '50000',
          counter: 'USDT',
          high: '50100',
          low: '49900',
          open: '50000',
          openTimeInISO: '2021-01-01T00:00:00.000Z',
          openTimeInMillis: 1609459200000,
          sizeInMillis: 60000,
          volume: '10',
        },
        {
          base: 'BTC',
          close: '50100',
          counter: 'USDT',
          high: '50200',
          low: '50000',
          open: '50000',
          openTimeInISO: '2021-01-01T00:01:00.000Z',
          openTimeInMillis: 1609459260000,
          sizeInMillis: 60000,
          volume: '0',
        },
        {
          base: 'BTC',
          close: '50200',
          counter: 'USDT',
          high: '50300',
          low: '50100',
          open: '50100',
          openTimeInISO: '2021-01-01T00:02:00.000Z',
          openTimeInMillis: 1609459320000,
          sizeInMillis: 60000,
          volume: '15',
        },
      ];

      const cb = new CandleBatcher(ms('5m'));
      const batchedCandles: BatchedCandle[] = [];

      candles.forEach(candle => {
        const batch = cb.addToBatch(candle);
        if (batch) {
          batchedCandles.push(batch);
        }
      });

      expect(batchedCandles.length).toBe(0);
      expect(cb['batch'].length).toBe(2);
      expect(cb['batch'].every(c => c.volume !== '0')).toBe(true);
    });

    it('does not batch candles which are already part of the batch', () => {
      const cb = new CandleBatcher(ms('1h'));

      const candles: ExchangeCandle[] = [
        {
          base: 'BNB',
          close: '404.64860000',
          counter: 'USDT',
          high: '405.21810000',
          low: '403.25970000',
          open: '403.26070000',
          openTimeInISO: '2021-04-07T00:00:00.000Z',
          openTimeInMillis: 1617753600000,
          sizeInMillis: 60000,
          volume: '4707.18800000',
        },
        {
          base: 'BNB',
          close: '403.50010000',
          counter: 'USDT',
          high: '405.44930000',
          low: '403.29040000',
          open: '404.70000000',
          openTimeInISO: '2021-04-07T00:01:00.000Z',
          openTimeInMillis: 1617753660000,
          sizeInMillis: 60000,
          volume: '3774.42400000',
        },
        {
          base: 'BNB',
          close: '404.40390000',
          counter: 'USDT',
          high: '404.82960000',
          low: '403.09280000',
          open: '403.71630000',
          openTimeInISO: '2021-04-07T01:00:00.000Z',
          openTimeInMillis: 1617757200000,
          sizeInMillis: 60000,
          volume: '1954.12000000',
        },
      ];

      cb.addToBatch(candles[0]);
      expect(cb['batch'].length).toBe(1);

      cb.addToBatch(candles[1]);
      expect(cb['batch'].length).toBe(2);

      // Add duplicate
      cb.addToBatch(candles[1]);

      const batch = cb.addToBatch(candles[2]);
      // Candle duplicates are filtered
      expect(batch?.volume.toString()).toBe('8481.612');
    });

    it('closes a 5-minute interval when 5 minutes are over and candles are missing in the start', () => {
      const cb = new CandleBatcher(ms('5m'));
      const batchedCandles: BatchedCandle[] = [];

      TenMinutesMissingStart.forEach(candle => {
        const batch = cb.addToBatch(candle);
        if (batch) {
          batchedCandles.push(batch);
        }
      });

      expect(batchedCandles[0].openTimeInISO).toBe('2021-05-25T08:00:00.000Z');
      expect(batchedCandles[0].openTimeInMillis).toBe(1621929600000);
      // First batch consists only of 2 candles (08:03 & 08:04)
      expect(batchedCandles[0].medianPrice.valueOf()).toBe('610.85');

      expect(batchedCandles[1].openTimeInISO).toBe('2021-05-25T08:05:00.000Z');
      expect(batchedCandles[1].openTimeInMillis).toBe(1621929900000);
    });

    it('closes a 5-minute interval when 5 minutes are over and last candle is missing', () => {
      const cb = new CandleBatcher(ms('5m'));
      const batchedCandles: BatchedCandle[] = [];

      TenMinutesMissingEnd.forEach(candle => {
        const batch = cb.addToBatch(candle);
        if (batch) {
          batchedCandles.push(batch);
        }
      });

      expect(batchedCandles[0].openTimeInISO).toBe('2021-05-25T08:00:00.000Z');
      // Candle from 08:04 is missing
      expect(batchedCandles[0].close.valueOf()).toBe('611.5');

      expect(batchedCandles[1].openTimeInISO).toBe('2021-05-25T08:05:00.000Z');
    });

    it('emits events for batched candles', () => {
      const onBatchedCandle = vi.fn();
      const cb = new CandleBatcher(ms('5m'));
      cb.on('batchedCandle', onBatchedCandle);
      let latestBatch: BatchedCandle | undefined = undefined;

      TenMinutesInTenCandles.forEach(candle => {
        const batch = cb.addToBatch(candle);

        if (batch) {
          latestBatch = batch;
        }
      });

      expect(latestBatch).not.toBeUndefined();
      expect(onBatchedCandle).toHaveBeenCalledTimes(2);
      expect(onBatchedCandle).toHaveBeenLastCalledWith(latestBatch);
    });
  });

  describe('batchMany', () => {
    it('batches many candles at once', () => {
      expect(OneWeekInMinutes.length).toBe(10_080);
      const hourlyCandles = CandleBatcher.batchMany(OneWeekInMinutes, ms('1h'));
      expect(hourlyCandles.length).toBe(168);
    });

    it('batches in 5-minute intervals', () => {
      const batchedCandles = CandleBatcher.batchMany(TenMinutesInTenCandles, ms('5m'));
      expect(TenMinutesInTenCandles.length).toBe(10);
      expect(batchedCandles.length).toBe(2);

      expect(batchedCandles[0].openTimeInISO).toBe('2021-05-25T08:00:00.000Z');
      expect(batchedCandles[0].openTimeInMillis).toBe(1621929600000);
      expect(batchedCandles[0].medianPrice.valueOf()).toBe('611.165');

      expect(batchedCandles[1].openTimeInISO).toBe('2021-05-25T08:05:00.000Z');
      expect(batchedCandles[1].openTimeInMillis).toBe(1621929900000);
    });

    it('closes a 5-minute interval when 5 minutes are over and a candle is missing in-between', () => {
      const batchedCandles = CandleBatcher.batchMany(TenMinutesInEightCandles, ms('5m'));
      expect(TenMinutesInEightCandles.length).toBe(8);
      expect(batchedCandles.length).toBe(2);

      expect(batchedCandles[0].openTimeInISO).toBe('2021-05-25T08:00:00.000Z');
      expect(batchedCandles[0].openTimeInMillis).toBe(1621929600000);
      // Candles from 08:02 & 08:03 are missing
      expect(batchedCandles[0].medianPrice.valueOf()).toBe('610.785');

      expect(batchedCandles[1].openTimeInISO).toBe('2021-05-25T08:05:00.000Z');
      expect(batchedCandles[1].openTimeInMillis).toBe(1621929900000);
    });

    it('closes a 5-minute interval when 5 minutes are over and candles are missing in the start', () => {
      const batchedCandles = CandleBatcher.batchMany(TenMinutesMissingStart, ms('5m'));
      expect(TenMinutesMissingStart.length).toBe(7);
      expect(batchedCandles.length).toBe(2);

      expect(batchedCandles[0].openTimeInISO).toBe('2021-05-25T08:00:00.000Z');
      expect(batchedCandles[0].openTimeInMillis).toBe(1621929600000);
      // First batch consists only of 2 candles (08:03 & 08:04)
      expect(batchedCandles[0].medianPrice.valueOf()).toBe('610.85');

      expect(batchedCandles[1].openTimeInISO).toBe('2021-05-25T08:05:00.000Z');
      expect(batchedCandles[1].openTimeInMillis).toBe(1621929900000);
    });
  });

  describe('createBatchedCandle', () => {
    const candles = one_hour_in_minutes;
    const batchedCandle = CandleBatcher.createBatchedCandle(candles, ms('1h'));

    it('calculates median price', () => {
      expect(batchedCandle.medianPrice.toFixed(8)).toBe('0.03130000');
    });

    it('calculates weighted median price', () => {
      expect(batchedCandle.weightedMedianPrice.toFixed(8)).toBe('0.03131498');
    });

    it('calculates the price change', () => {
      const candles: ExchangeCandle[] = [
        {
          base: 'BTC',
          close: '35692.69000000',
          counter: 'USDT',
          high: '35717.00000000',
          low: '35525.75000000',
          open: '35525.75000000',
          openTimeInISO: '2021-06-21T00:02:00.000Z',
          openTimeInMillis: 1624233720000,
          sizeInMillis: 60000,
          volume: '129.77635000',
        },
      ];

      const candle = CandleBatcher.createBatchedCandle(candles, candles[0].sizeInMillis);
      expect(candle.change.toFixed(2)).toBe('0.47');
    });
  });

  describe('getHighAndLow', () => {
    it('finds the high and low of multiple candles', () => {
      const candles: ExchangeCandle[] = [
        {
          base: 'BNB',
          close: '38.66140000',
          counter: 'USDT',
          high: '38.78550000',
          low: '38.61950000',
          open: '38.65960000',
          openTimeInISO: '2021-01-22T00:00:00.000Z',
          openTimeInMillis: 1611273600000,
          sizeInMillis: 60000,
          volume: '5872.75300000',
        },
        {
          base: 'BNB',
          close: '38.48190000',
          counter: 'USDT',
          high: '38.68290000',
          low: '38.45430000',
          open: '38.68270000',
          openTimeInISO: '2021-01-22T00:01:00.000Z',
          openTimeInMillis: 1611273660000,
          sizeInMillis: 60000,
          volume: '3401.83300000',
        },
        {
          base: 'BNB',
          close: '38.49510000',
          counter: 'USDT',
          high: '38.69440000',
          low: '38.41500000',
          open: '38.49170000',
          openTimeInISO: '2021-01-22T00:02:00.000Z',
          openTimeInMillis: 1611273720000,
          sizeInMillis: 60000,
          volume: '6587.95600000',
        },
      ];

      const {high, low} = CandleBatcher.getHighAndLow(candles);
      expect(low.valueOf()).toBe('38.415');
      expect(high.valueOf()).toBe('38.7855');
    });
  });
});
