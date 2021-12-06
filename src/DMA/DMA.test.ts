import twoDays from '../test/fixtures/DMA/LTC-USDT-1h-2d.json';
import {DMA, FasterDMA} from './DMA';
import {EMA, SMA} from '..';

describe('DMA', () => {
  describe('constructor', () => {
    it('can be used with simple moving averages', () => {
      const dma = new DMA(3, 6, SMA);
      dma.update(41);
      dma.update(37);
      dma.update(20.9);
      dma.update(100);
      dma.update(30.71);
      dma.update(30);
      expect(dma.getResult().short.toFixed(8)).withContext('short').toBe('53.57000000');
      expect(dma.getResult().long.toFixed(8)).withContext('long').toBe('43.26833333');
    });

    it('can be used with exponential moving averages', () => {
      const dma = new DMA(3, 6, EMA);
      dma.update(41);
      dma.update(37);
      dma.update(20.9);
      dma.update(100);
      dma.update(30.71);
      dma.update(30);
      expect(dma.getResult().short.toFixed(8)).withContext('short').toBe('38.92125000');
      expect(dma.getResult().long.toFixed(8)).withContext('long').toBe('41.96735289');
    });
  });

  describe('isStable', () => {
    it('is dependant on the long interval (SMA)', () => {
      const dma = new DMA(3, 5);
      dma.update(40);
      dma.update(30);
      dma.update(20);
      expect(dma.isStable).toBeFalse();
      dma.update(10);
      dma.update(30);
      expect(dma.isStable).toBeTrue();
    });

    it('is dependant on the long interval (EMA)', () => {
      const dma = new DMA(3, 5, EMA);
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
      const fasterDMA = new FasterDMA(3, 8);
      const nineHours = twoDays.slice(0, 9);

      for (const oneHour of nineHours) {
        const price = oneHour.close;
        dma.update(price);
        fasterDMA.update(parseFloat(price));
      }

      const {short, long} = dma.getResult();
      expect(short.gt(long)).toBeTrue();

      const fasterResult = fasterDMA.getResult();
      expect(fasterDMA.isStable).toBeTrue();
      expect(fasterResult.short > fasterResult.long).toBeTrue();
    });
  });
});
