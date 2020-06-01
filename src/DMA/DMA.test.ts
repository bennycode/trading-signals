import twoDays from '../test/fixtures/DMA/LTC-USDT-1h-2d.json';
import {DMA} from './DMA';

describe('DMA', () => {
  describe('isStable', () => {
    it('is dependant on the long interval', () => {
      const dma = new DMA(3, 5);
      dma.update(40);
      dma.update(30);
      dma.update(20);
      expect(dma.isStable).toBeFalse();
      dma.update(10);
      dma.update(30);
      expect(dma.isStable).toBeTrue();
    });
  });

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
