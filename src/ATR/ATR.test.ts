import {Big} from 'big.js';
import {ATR} from './ATR';
import {NotEnoughDataError} from '..';

import data from '../test/fixtures/ATR/data.json';

const candles = data.candles;
const atr14results = data.interval_14;

describe('ATR', () => {
  describe('getResult', () => {
    it('calculates the ATR with interval 14', () => {
      const atr = new ATR(14);

      candles.forEach((candle, index) => {
        atr.update(candle);

        if (atr.isStable) {
          const result = new Big(Number(atr14results[index]));
          expect(atr.getResult().toFixed(4)).toEqual(result.toFixed(4));
        }
      });

      expect(atr.lowest!.toFixed(2)).toBe('0.55');
      expect(atr.highest!.toFixed(2)).toBe('1.37');
    });

    it('throws an error when there is not enough input data', () => {
      const atr = new ATR(14);

      try {
        atr.getResult();
        fail('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });
});
