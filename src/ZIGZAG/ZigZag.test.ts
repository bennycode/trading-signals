import {ZigZag, FasterZigZag} from './ZigZag.js';
import {expect} from 'vitest';
import Big from 'big.js';

describe('ZigZag & FasterZigZag', () => {
  describe('constructor', () => {
    it('throws an error when deviation is zero or negative', () => {
      expect(() => new ZigZag({deviation: 0})).toThrow('Deviation must be greater than 0');
      expect(() => new ZigZag({deviation: -0.1})).toThrow('Deviation must be greater than 0');
      expect(() => new FasterZigZag({deviation: 0})).toThrow('Deviation must be greater than 0');
      expect(() => new FasterZigZag({deviation: -0.1})).toThrow('Deviation must be greater than 0');
    });

    it('accepts valid deviation values', () => {
      expect(() => new ZigZag({deviation: 0.05})).not.toThrow();
      expect(() => new FasterZigZag({deviation: 0.05})).not.toThrow();
    });
  });

  describe('getRequiredInputs', () => {
    it('returns 1 as minimum required inputs', () => {
      const zigzag = new ZigZag({deviation: 0.05});
      const fasterZigzag = new FasterZigZag({deviation: 0.05});

      expect(zigzag.getRequiredInputs()).toBe(1);
      expect(fasterZigzag.getRequiredInputs()).toBe(1);
    });
  });

  describe('isStable', () => {
    it('returns true after first input', () => {
      const zigzag = new ZigZag({deviation: 0.05});
      const fasterZigzag = new FasterZigZag({deviation: 0.05});

      expect(zigzag.isStable).toBe(false);
      expect(fasterZigzag.isStable).toBe(false);

      zigzag.add({high: 100, low: 99});
      fasterZigzag.add({high: 100, low: 99});

      expect(zigzag.isStable).toBe(true);
      expect(fasterZigzag.isStable).toBe(true);
    });
  });

  describe('update', () => {
    it('returns the first high value on initial input', () => {
      const zigzag = new ZigZag({deviation: 0.05});
      const fasterZigzag = new FasterZigZag({deviation: 0.05});

      const result1 = zigzag.add({high: 100, low: 99});
      const result2 = fasterZigzag.add({high: 100, low: 99});

      expect(result1?.valueOf()).toBe('100');
      expect(result2).toBe(100);
    });

    it('returns null until a significant reversal occurs', () => {
      const deviation = 0.05; // 5%
      const zigzag = new ZigZag({deviation});
      const fasterZigzag = new FasterZigZag({deviation});

      // Initial high at 100
      const result1 = zigzag.add({high: 100, low: 99});
      const result2 = fasterZigzag.add({high: 100, low: 99});
      expect(result1?.valueOf()).toBe('100');
      expect(result2).toBe(100);

      // Higher high - should still return null (no confirmed extreme yet)
      let result3 = zigzag.add({high: 101, low: 97}); // High goes to 101, low 97 = 3.96% down
      let result4 = fasterZigzag.add({high: 101, low: 97});
      expect(result3).toBeNull();
      expect(result4).toBeNull();

      // Higher high but still no significant reversal
      result3 = zigzag.add({high: 102, low: 98}); // High goes to 102, low 98 = 3.92% down, not enough
      result4 = fasterZigzag.add({high: 102, low: 98});
      expect(result3).toBeNull();
      expect(result4).toBeNull();
    });

    it('detects significant low after high', () => {
      const deviation = 0.05; // 5%
      const zigzag = new ZigZag({deviation});
      const fasterZigzag = new FasterZigZag({deviation});

      // Initial high at 100
      zigzag.add({high: 100, low: 99});
      fasterZigzag.add({high: 100, low: 99});

      // Higher high at 105
      zigzag.add({high: 105, low: 102});
      fasterZigzag.add({high: 105, low: 102});

      // Significant low (more than 5% down from 105)
      const result1 = zigzag.add({high: 98, low: 95}); // 95 is ~9.5% down from 105
      const result2 = fasterZigzag.add({high: 98, low: 95});

      expect(result1?.valueOf()).toBe('105'); // Should return the confirmed high
      expect(result2).toBe(105);
    });

    it('detects significant high after low', () => {
      const deviation = 0.05; // 5%
      const zigzag = new ZigZag({deviation});
      const fasterZigzag = new FasterZigZag({deviation});

      // Start with a pattern that establishes a low
      zigzag.add({high: 100, low: 99});
      fasterZigzag.add({high: 100, low: 99});

      // Create a confirmed low
      zigzag.add({high: 98, low: 95}); // Triggers low detection
      fasterZigzag.add({high: 98, low: 95});

      // Lower low
      zigzag.add({high: 92, low: 90});
      fasterZigzag.add({high: 92, low: 90});

      // Significant high (more than 5% up from 90)
      const result1 = zigzag.add({high: 105, low: 98}); // ~16.7% up from 90
      const result2 = fasterZigzag.add({high: 105, low: 98});

      expect(result1?.valueOf()).toBe('90'); // Should return the confirmed low
      expect(result2).toBe(90);
    });

    it('handles complex zigzag pattern correctly', () => {
      const deviation = 0.1; // 10% for clearer pattern
      const zigzag = new ZigZag({deviation});
      const fasterZigzag = new FasterZigZag({deviation});

      const testData = [
        {high: 100, low: 99, expectedResult: 100}, // Initial high
        {high: 105, low: 102, expectedResult: null}, // Higher high pending
        {high: 110, low: 107, expectedResult: null}, // Even higher high pending  
        {high: 102, low: 95, expectedResult: 110}, // Significant drop (13.6% from 110) confirms high at 110
        {high: 98, low: 85, expectedResult: null}, // Lower low pending (85 is ~23% below 110)
        {high: 95, low: 80, expectedResult: null}, // Even lower low pending
        {high: 100, low: 88, expectedResult: 80}, // Significant rise (25% from 80) confirms low at 80
      ];

      const zigzagResults: (number | null)[] = [];
      const fasterZigzagResults: (number | null)[] = [];

      for (const candle of testData) {
        const result1 = zigzag.add({high: candle.high, low: candle.low});
        const result2 = fasterZigzag.add({high: candle.high, low: candle.low});

        zigzagResults.push(result1 ? Number(result1.valueOf()) : null);
        fasterZigzagResults.push(result2);
      }

      const expectedResults = testData.map(d => d.expectedResult);

      expect(zigzagResults).toEqual(expectedResults);
      expect(fasterZigzagResults).toEqual(expectedResults);
    });

    it('maintains correct state when replacing values', () => {
      const deviation = 0.05;
      const zigzag = new ZigZag({deviation});
      const fasterZigzag = new FasterZigZag({deviation});

      // Build initial pattern
      zigzag.add({high: 100, low: 99});
      fasterZigzag.add({high: 100, low: 99});

      zigzag.add({high: 105, low: 102});
      fasterZigzag.add({high: 105, low: 102});

      const result1 = zigzag.add({high: 98, low: 95});
      const result2 = fasterZigzag.add({high: 98, low: 95});

      // Replace the last value
      const replacedResult1 = zigzag.replace({high: 97, low: 94});
      const replacedResult2 = fasterZigzag.replace({high: 97, low: 94});

      // Should still trigger the same extreme point
      expect(replacedResult1?.valueOf()).toBe('105');
      expect(replacedResult2).toBe(105);
    });
  });

  describe('getResult', () => {
    it('returns null when no extreme point has been confirmed', () => {
      const zigzag = new ZigZag({deviation: 0.05});
      const fasterZigzag = new FasterZigZag({deviation: 0.05});

      expect(zigzag.getResult()).toBeNull();
      expect(fasterZigzag.getResult()).toBeNull();

      // Add data but no significant reversal
      zigzag.add({high: 100, low: 99});
      fasterZigzag.add({high: 100, low: 99});

      // The first point is returned immediately
      expect(zigzag.getResult()?.valueOf()).toBe('100');
      expect(fasterZigzag.getResult()).toBe(100);
    });
  });

  describe('edge cases', () => {
    it('handles very small deviation thresholds', () => {
      const zigzag = new ZigZag({deviation: 0.001}); // 0.1%
      const fasterZigzag = new FasterZigZag({deviation: 0.001});

      zigzag.add({high: 100, low: 99});
      fasterZigzag.add({high: 100, low: 99});

      // Very small movement should trigger reversal
      const result1 = zigzag.add({high: 99.8, low: 99.85});
      const result2 = fasterZigzag.add({high: 99.8, low: 99.85});

      expect(result1?.valueOf()).toBe('100');
      expect(result2).toBe(100);
    });

    it('handles equal high and low values', () => {
      const zigzag = new ZigZag({deviation: 0.05});
      const fasterZigzag = new FasterZigZag({deviation: 0.05});

      const result1 = zigzag.add({high: 100, low: 100});
      const result2 = fasterZigzag.add({high: 100, low: 100});

      expect(result1?.valueOf()).toBe('100');
      expect(result2).toBe(100);
    });

    it('handles large price movements', () => {
      const zigzag = new ZigZag({deviation: 0.05});
      const fasterZigzag = new FasterZigZag({deviation: 0.05});

      zigzag.add({high: 1000000, low: 999000});
      fasterZigzag.add({high: 1000000, low: 999000});

      // Large movement
      const result1 = zigzag.add({high: 950000, low: 900000});
      const result2 = fasterZigzag.add({high: 950000, low: 900000});

      expect(result1?.valueOf()).toBe('1000000');
      expect(result2).toBe(1000000);
    });
  });
});