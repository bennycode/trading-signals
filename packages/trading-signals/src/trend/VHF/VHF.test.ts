import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';
import {VHF} from './VHF.js';

describe('VHF', () => {
  describe('constructor', () => {
    it("uses Adam White's 28-period window by default", () => {
      const vhf = new VHF();

      expect(vhf.interval).toBe(28);
      expect(vhf.getRequiredInputs()).toBe(29);
    });

    it('rejects a window that cannot hold a single close', () => {
      expect(() => new VHF(0)).toThrowError('The interval has to be at least 1, but "0" was given.');
      expect(() => new VHF(-3)).toThrowError('The interval has to be at least 1, but "-3" was given.');
    });
  });

  describe('getResultOrThrow', () => {
    it('matches the Tulip Indicators reference results', {tags: ['tulipindicators']}, () => {
      /*
       * Test data verified with:
       * https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/untest.txt#L450-L452
       *
       * Tulip's first reading appears one close after the window fills: the span reads off the last
       * five closes while the path already includes the move that carried price into them.
       */
      const closes = [
        81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29,
      ] as const;
      const expectations = [
        '0.720',
        '0.232',
        '0.432',
        '0.553',
        '0.640',
        '0.796',
        '0.625',
        '0.771',
        '0.947',
        '0.576',
      ] as const;
      const vhf = new VHF(5);
      const offset = vhf.getRequiredInputs() - 1;

      closes.forEach((close, i) => {
        const result = vhf.add(close);

        if (i < offset) {
          expect(result).toBeNull();
        } else {
          expect(result?.toFixed(3)).toBe(expectations[i - offset]);
        }
      });

      expect(vhf.isStable).toBe(true);
    });

    it('reads a dead-flat market as having no trend to measure', () => {
      // Price that never moved has neither a span nor a path, so the reading is pinned at 0
      const vhf = new VHF(3);

      for (let i = 0; i < 4; i++) {
        vhf.add(100);
      }

      expect(vhf.getResultOrThrow()).toBe(0);
    });

    it('reads a window price merely settled into as trendless', () => {
      // The drop into the window still counts toward the path, but the settled closes have no span
      const closes = [110, 100, 100, 100] as const;
      const vhf = new VHF(3);

      for (const close of closes) {
        vhf.add(close);
      }

      expect(vhf.getResultOrThrow()).toBe(0);
    });
  });

  describe('replace', () => {
    it('replaces the most recently added close', () => {
      const closes = [10, 12, 11, 14] as const;
      const vhf = new VHF(3);

      for (const close of closes) {
        vhf.add(close);
      }

      // Span 11 to 14 over a path of 2 + 1 + 3
      expect(vhf.getResultOrThrow()).toBe(0.5);

      // Span 11 to 20 = 9 over a path of 1 + 3 + 6 = 10
      const originalClose = 20;
      // Span 11 to 14 = 3 over a path of 1 + 3 + 2 = 6
      const replacementClose = 12;

      const originalResult = vhf.add(originalClose);

      expect(originalResult).toBe(0.9);

      const replacedResult = vhf.replace(replacementClose);

      expect(replacedResult).toBe(0.5);

      const restoredResult = vhf.replace(originalClose);

      expect(restoredResult).toBe(originalResult);
    });

    it('replaces the seed close before the first move exists', () => {
      const seedReplacement = 15;
      const closes = [12, 11, 14] as const;

      const replaced = new VHF(3);
      replaced.add(10);
      replaced.replace(seedReplacement);

      const reference = new VHF(3);
      reference.add(seedReplacement);

      for (const close of closes) {
        replaced.add(close);
        reference.add(close);
      }

      // Span 11 to 14 = 3 over a path of 3 + 1 + 3 = 7
      expect(replaced.getResultOrThrow()).toBe(reference.getResultOrThrow());
      expect(replaced.getResultOrThrow()).toBe(0.42857142857142855);
    });
  });
});

testIndicatorContract({
  create: () => new VHF(5),
  divergentInput: 1_000,
  inputs: [81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84],
});
