import twoDays from '../test/fixtures/DMA/LTC-USDT-1h-2d.json' with {type: 'json'};
import {DMA, FasterDMA} from './DMA.js';
import {EMA, FasterSMA, SMA} from '../index.js';

describe('DMA', () => {
  describe('update', () => {
    it('can replace recently added values', () => {
      const dma = new DMA(3, 6, SMA);
      const fasterDMA = new FasterDMA(3, 6, FasterSMA);
      dma.updates([41, 37, 20.9, 100, 30.71, 40], false);
      dma.update(30, true);

      expect(dma.isStable).toBe(true);
      expect(dma.getResultOrThrow().short.toFixed(8)).toBe('53.57000000');
      expect(dma.getResultOrThrow().long.toFixed(8)).toBe('43.26833333');

      fasterDMA.updates([41, 37, 20.9, 100, 30.71, 40], false);
      fasterDMA.update(30, true);

      expect(fasterDMA.isStable).toBe(true);
      expect(fasterDMA.getResultOrThrow().short.toFixed(8)).toBe('53.57000000');
      expect(fasterDMA.getResultOrThrow().long.toFixed(8)).toBe('43.26833333');
    });
  });

  describe('constructor', () => {
    it('can be used with simple moving averages', () => {
      const dma = new DMA(3, 6, SMA);
      dma.add(41);
      dma.add(37);
      dma.add(20.9);
      dma.add(100);
      dma.add(30.71);
      dma.add(30);
      expect(dma.getResultOrThrow().short.toFixed(8)).toBe('53.57000000');
      expect(dma.getResultOrThrow().long.toFixed(8)).toBe('43.26833333');
    });

    it('can be used with exponential moving averages', () => {
      const dma = new DMA(3, 6, EMA);
      dma.add(41);
      dma.add(37);
      dma.add(20.9);
      dma.add(100);
      dma.add(30.71);
      dma.add(30);
      expect(dma.getResultOrThrow().short.toFixed(8)).toBe('38.92125000');
      expect(dma.getResultOrThrow().long.toFixed(8)).toBe('41.96735289');
    });
  });

  describe('isStable', () => {
    it('is dependant on the long interval (SMA)', () => {
      const dma = new DMA(3, 5);
      dma.add(40);
      dma.add(30);
      dma.add(20);
      expect(dma.isStable).toBe(false);
      dma.add(10);
      dma.add(30);
      expect(dma.isStable).toBe(true);
    });

    it('is dependant on the long interval (EMA)', () => {
      const dma = new DMA(3, 5, EMA);
      dma.add(40);
      dma.add(30);
      dma.add(20);
      expect(dma.isStable).toBe(false);
      dma.add(10);
      dma.add(30);
      expect(dma.isStable).toBe(true);
    });
  });

  describe('getResultOrThrow', () => {
    it('detects uptrends', () => {
      const longInterval = 8;
      const dma = new DMA(3, longInterval);
      const fasterDMA = new FasterDMA(3, longInterval);
      const nineHours = twoDays.slice(0, 9);

      for (const oneHour of nineHours) {
        const price = oneHour.close;
        dma.add(price);
        fasterDMA.add(parseFloat(price));
      }

      const {short, long} = dma.getResultOrThrow();
      expect(dma.getRequiredInputs()).toBe(longInterval);
      expect(dma.isStable).toBe(true);
      expect(short.gt(long)).toBe(true);

      const fasterResult = fasterDMA.getResultOrThrow();
      expect(fasterDMA.getRequiredInputs()).toBe(longInterval);
      expect(fasterDMA.isStable).toBe(true);
      expect(fasterResult.short > fasterResult.long).toBe(true);
    });
  });
});
