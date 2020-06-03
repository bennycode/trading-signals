import {Big as BigNumber} from 'big.js';
import {ADX} from './ADX';

import data from '../test/fixtures/ADX/data.json';
import {NotEnoughDataError} from '..';

const candles = data.candles;
const adx14results = data.interval_14;

describe('ADX', () => {
  describe('getResult', () => {
    it('should correctly calculate the ADX with interval 14', () => {
      const adx = new ADX(14);
      candles.forEach((candle, index) => {
        adx.update(candle);

        if (adx.isStable) {
          const res = new BigNumber(adx14results[index] as number);
          expect(adx.getResult().toFixed(4)).toEqual(res.toFixed(4));
        }
      });
    });

    it('throws an error when there is not enough input data', () => {
      const adx = new ADX(14);

      try {
        adx.getResult();
        fail('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });
});
