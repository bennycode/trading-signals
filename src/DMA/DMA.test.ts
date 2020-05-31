import twoDays from '../test/fixtures/DMA/LTC-USDT-1h-2d.json';
import {DMA} from './DMA';

describe('DMA', () => {
  describe('getResult', () => {
    it('detects uptrends', () => {
      const dma = new DMA(3, 8);
      const nineHours = twoDays.slice(0, 9);

      for (const oneHour of nineHours) {
        const price = oneHour.close;
        dma.update(price);
      }

      const {short, long} = dma.getResult();
      expect(short.gt(long)).toBeTrue();
    });
  });
});
