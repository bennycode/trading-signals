import {Big} from '../index.js';
import {DEMA, FasterDEMA} from './DEMA.js';
import {NotEnoughDataError} from '../error/index.js';

const dema10results = [
  81, 62.157024793388416, 65.1412471825695, 49.61361928829999, 42.570707415663364, 34.597495090487996,
  44.47997295246192, 58.6168391922143, 71.4979863711489, 48.963944850563, 60.095241192962106, 66.41965473810654,
  69.77997604557987, 49.75572911767095, 61.08641574881719, 65.56112611350791, 54.65374623818491, 57.51231851211959,
  51.73955057939423, 36.941596820151815, 27.434153499662216, 24.890025210750593, 33.14097982029734, 30.163817870645254,
  40.330715478873344, 45.63811915119551, 36.045947422710505, 53.12735486322183, 64.78921092296176, 72.9995704035162,
  83.22304838955624, 58.85287916072168, 62.841348382387075, 42.93804766689409, 36.82301007497254, 26.454331684513562,
  46.374329400503385, 53.28360623846342, 38.891184741941984,
];

describe('DEMA', () => {
  describe('update', () => {
    it('can replace recently added values', () => {
      const dema = new DEMA(10);
      const fasterDEMA = new FasterDEMA(10);
      dema.update(81);
      fasterDEMA.update(81);
      dema.update(24);
      fasterDEMA.update(24);
      dema.update(75);
      fasterDEMA.update(75);
      dema.update(21);
      fasterDEMA.update(21);
      dema.update(34);
      fasterDEMA.update(34);
      dema.update(25);
      fasterDEMA.update(25);
      dema.update(72);
      fasterDEMA.update(72);
      dema.update(92);
      fasterDEMA.update(92);
      dema.update(100);
      fasterDEMA.update(100);
      dema.update(99, true);
      fasterDEMA.update(99, true);
      dema.update(2);
      fasterDEMA.update(2);

      expect(dema.isStable).toBe(true);
      expect(fasterDEMA.isStable).toBe(true);

      expect(dema.getResult().toFixed(2)).toBe('48.96');
      expect(fasterDEMA.getResult().toFixed(2)).toBe('48.96');
    });
  });

  describe('getResult', () => {
    it('calculates the DEMA with interval 10', () => {
      const prices = [
        81, 24, 75, 21, 34, 25, 72, 92, 99, 2, 86, 80, 76, 8, 87, 75, 32, 65, 41, 9, 13, 26, 56, 28, 65, 58, 17, 90, 87,
        86, 99, 3, 70, 1, 27, 9, 92, 68, 9,
      ];

      const dema = new DEMA(10);
      const fasterDEMA = new FasterDEMA(10);

      prices.forEach((price, index) => {
        dema.update(price);
        fasterDEMA.update(price);
        if (dema.isStable) {
          const result = new Big(dema10results[index]);
          expect(dema.getResult().toPrecision(12)).toEqual(result.toPrecision(12));
          expect(fasterDEMA.getResult().toPrecision(4)).toEqual(result.toPrecision(4));
        }
      });

      expect(dema.isStable).toBe(true);
      expect(fasterDEMA.isStable).toBe(true);

      expect(dema.lowest!.toFixed(2)).toBe('24.89');
      expect(fasterDEMA.lowest!.toFixed(2)).toBe('24.89');

      expect(dema.highest!.toFixed(2)).toBe('83.22');
      expect(fasterDEMA.highest!.toFixed(2)).toBe('83.22');
    });

    it('throws an error when there is not enough input data', () => {
      const dema = new DEMA(10);

      try {
        dema.getResult();
        throw new Error('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(NotEnoughDataError);
      }
    });
  });

  describe('isStable', () => {
    it('is stable when there are enough inputs to fill the interval', () => {
      const dema = new DEMA(2);
      expect(dema.isStable).toBe(false);
      dema.update(1);
      dema.update(2);
      expect(dema.isStable).toBe(true);
      expect(dema.lowest!.toFixed(2)).toBe('1.00');
      expect(dema.highest!.toFixed(2)).toBe('1.89');
    });
  });
});
