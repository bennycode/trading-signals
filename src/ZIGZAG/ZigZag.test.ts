import {ZigZag, FasterZigZag} from './ZigZag.js';
import {NotEnoughDataError} from '../error/index.js';
import Big from 'big.js';

describe('ZigZag', () => {
  const testData = [
    {high: 10, low: 9},
    {high: 11, low: 10}, // Higher high [11], not significant yet
    {high: 8, low: 7}, // Significant drop from 11 -> [7] (36.36%)
    {high: 9, low: 8}, // Higher but not significant, [7] -> 9 (28.57%)
    {high: 12, low: 11}, // Significant rise from 7 -> [12] (71.43%)
    {high: 9, low: 8}, // Significant drop from 12 -> [8] (33.33%)
    {high: 14, low: 13}, // Significant rise from 8 -> [14] (75%)
    {high: 13, low: 12}, // Drop but not significant, [14] -> 12 (14.29%)
    {high: 10, low: 9}, // Significant drop from 14 -> [9] (35.71%)
  ];

  it('calculates ZigZag points correctly with 30% threshold (less sensitive)', () => {
    const zigzag = new ZigZag({deviation: 30});
    const results: (Big | null)[] = [];

    testData.forEach(candle => {
      results.push(zigzag.add({high: candle.high, low: candle.low}));
    });

    expect(results[0]).toBeNull(); // initial point
    expect(results[1]).toBeNull(); // no significant change
    expect(results[2]?.toString()).toBe('11');
    expect(results[3]?.toString()).toBe('11');
    expect(results[4]?.toString()).toBe('7');
    expect(results[5]?.toString()).toBe('12');
    expect(results[6]?.toString()).toBe('8');
    expect(results[7]?.toString()).toBe('14');
    expect(results[8]?.toString()).toBe('14');
  });

  it('handles validation of percentage threshold', () => {
    expect(() => new ZigZag({deviation: 0})).toThrow();
    expect(() => new ZigZag({deviation: -5})).toThrow();
    expect(() => new ZigZag({deviation: 5})).not.toThrow();
  });

  it('correctly returns null for not enough data', () => {
    const zigzag = new ZigZag({deviation: 5});

    // First candle
    const result1 = zigzag.update({high: 10, low: 9}, false);
    expect(result1).toBeNull();

    // Second candle without significant change
    const result2 = zigzag.update({high: 10.2, low: 9.1}, false);
    expect(result2).toBeNull();

    // Third candle with still no significant change
    const result3 = zigzag.update({high: 10.3, low: 9.2}, false);
    expect(result3).toBeNull();
  });

  it('throws when not enough data', () => {
    const zigzag = new ZigZag({deviation: 5});
    zigzag.update({high: 10, low: 9}, false);
    expect(() => zigzag.getResultOrThrow()).toThrow(NotEnoughDataError);
  });

  it('correctly indicates stability when there is a confirmed extreme', () => {
    const zigzag = new ZigZag({deviation: 5});

    expect(zigzag.isStable).toBe(false);

    // First candle
    zigzag.update({high: 10, low: 9}, false);
    expect(zigzag.isStable).toBe(false);

    // Second candle with no significant change
    zigzag.update({high: 10.2, low: 9.8}, false);
    expect(zigzag.isStable).toBe(false);

    // Third candle with significant change
    zigzag.update({high: 7, low: 6}, false);
    expect(zigzag.isStable).toBe(true);
  });

  it('replaces the most recently added value', () => {
    const zigzag = new ZigZag({deviation: 5});
    const candle = {high: 8, low: 7};
    const replacementCandle = {high: 75, low: 65};
    const expectedResult = '11';
    zigzag.add({high: 10, low: 9});
    zigzag.add({high: 11, low: 10});
    zigzag.add(candle);
    expect(zigzag.getResultOrThrow().toString()).toBe(expectedResult);
    const replacedResult = zigzag.replace(replacementCandle);
    expect(replacedResult?.toString()).toBe('75');
    const originalResult = zigzag.replace(candle);
    expect(originalResult?.toString()).toBe(expectedResult);
  });

  it('handles cases where a new high invalidates the current low swing', () => {
    const zigzag = new ZigZag({deviation: 5});

    // Setup a high and a significant drop
    zigzag.update({high: 10, low: 9}, false); // Initial
    zigzag.update({high: 12, low: 11}, false); // New high
    zigzag.update({high: 9, low: 8}, false); // Significant drop, confirms 12 as high

    // Get internal state
    expect(zigzag['lastExtremeValue']?.toString()).toBe('12');
    expect(zigzag['lastExtremeType']).toBe('high');

    // Now we're finding a low, but introduce a new higher high that invalidates our search for a low
    const result = zigzag.update({high: 13, low: 11}, false);

    // This should confirm the new high and invalidate our search for a low
    expect(result?.toString()).toBe('13');
    expect(zigzag['lastExtremeValue']?.toString()).toBe('13');
    expect(zigzag['lastExtremeType']).toBe('high');
  });

  it('handles cases where a new low invalidates the current high swing', () => {
    const zigzag = new ZigZag({deviation: 5});

    // Setup a high and a significant drop to establish a low
    zigzag.update({high: 10, low: 9}, false); // Initial
    zigzag.update({high: 12, low: 11}, false); // New high
    zigzag.update({high: 9, low: 8}, false); // Significant drop, confirms 12 as high

    // Now introduce a rally that's not yet significant
    zigzag.update({high: 10, low: 9}, false); // Starting to rise

    // Check internal state
    expect(zigzag['lastExtremeValue']?.toString()).toBe('8');
    expect(zigzag['lastExtremeType']).toBe('low');
    expect(zigzag['currentExtremeValue']?.toString()).toBe('10');
    expect(zigzag['currentExtremeType']).toBe('high');

    // Now introduce a new lower low that invalidates our current search for a high
    const result = zigzag.update({high: 8, low: 7}, false);

    // This should confirm the new low and invalidate our search for a high
    expect(result?.toString()).toBe('7');
    expect(zigzag['lastExtremeValue']?.toString()).toBe('7');
    expect(zigzag['lastExtremeType']).toBe('low');
  });

  it('correctly handles zero values in percentage calculation', () => {
    const zigzag = new ZigZag({deviation: 5});

    // TODO: Fix private access... Access the private calculatePercentChange method
    const percentChange = (zigzag as any).calculatePercentChange(new Big(0), new Big(10));
    expect(percentChange.toString()).toBe('0');
  });

  it('successfully returns result with getResultOrThrow when lastExtreme is not null', () => {
    const zigzag = new ZigZag({deviation: 5});

    // First, add enough candles to establish a confirmed ZigZag point
    // Add first candle
    zigzag.update({high: 100, low: 90}, false);

    // Add second candle with higher high
    zigzag.update({high: 110, low: 100}, false);

    // Add third candle with significant drop (>5%) to confirm the high
    const result = zigzag.update({high: 95, low: 85}, false);

    // Verify the result is the confirmed high extreme
    expect(result?.toNumber()).toBe(110);

    // Verify internal state
    expect(zigzag['lastExtremeValue']?.toString()).toBe('110');
    expect(zigzag['lastExtremeType']).toBe('high');

    // Now call getResultOrThrow which should hit line 177
    const throwResult = zigzag.getResultOrThrow();

    // Verify result matches the lastExtreme value
    expect(throwResult.toNumber()).toBe(110);

    // Add another candle with a more significant drop (> 20%)
    // to ensure it's tracking a new potential low
    zigzag.update({high: 70, low: 65}, false);

    // Add another candle with a significant rise to confirm the low
    const finalResult = zigzag.update({high: 100, low: 95}, false);

    // Now we should have a new result (the low at 65)
    expect(finalResult?.toNumber()).toBe(65);

    // getResultOrThrow should now return the updated value
    const updatedThrowResult = zigzag.getResultOrThrow();
    expect(updatedThrowResult.toNumber()).toBe(65);

    // Additional verification: Try getResult() which doesn't throw
    const normalResult = zigzag.getResult();
    expect(normalResult?.toNumber()).toBe(65);
  });

  it('returns null for the second candle when neither a new high nor a new low occurs', () => {
    const zigzag = new ZigZag({deviation: 5});
    const fasterZigZag = new FasterZigZag({deviation: 5});

    // First candle: sets currentExtreme
    zigzag.add({high: 100, low: 100});
    fasterZigZag.add({high: 100, low: 100});

    // Second candle: neither high > currentExtreme nor low < currentExtreme
    const result = zigzag.add({high: 100, low: 100});
    const fasterResult = fasterZigZag.add({high: 100, low: 100});
    expect(result).toBeNull();
    expect(fasterResult).toBeNull();
  });
});

describe('FasterZigZag', () => {
  const testData = [
    {high: 10, low: 9},
    {high: 11, low: 10}, // Higher high, not significant yet
    {high: 8, low: 7}, // Significant drop from 11 -> 7 (36.36%)
    {high: 9, low: 8}, // Higher but not significant
    {high: 12, low: 11}, // Significant rise from 7 -> 12 (71.43%)
    {high: 9, low: 8}, // Significant drop from 12 -> 8 (33.33%)
    {high: 14, low: 13}, // Significant rise from 8 -> 14 (75%)
    {high: 13, low: 12}, // Drop but not significant
    {high: 10, low: 9}, // Significant drop from 14 -> 9 (35.71%)
  ];

  it('calculates FasterZigZag points correctly with 30% threshold (less sensitive)', () => {
    const zigzag = new FasterZigZag({deviation: 30});
    const results: (number | null)[] = [];

    testData.forEach(candle => {
      results.push(zigzag.update({high: candle.high, low: candle.low}, false));
    });

    // With 30% threshold, we expect fewer significant points
    // Using the actual values from the implementation
    expect(results[0]).toBeNull(); // null (initial point)
    expect(results[1]).toBeNull(); // null (no significant change)
    expect(results[2]).toBe(11); // 11 (confirms the high at 11 as we move to significant low)
    expect(results[3]).toBe(11);
    expect(results[4]).toBe(7);
    expect(results[5]).toBe(12);
    expect(results[6]).toBe(8);
    expect(results[7]).toBe(14);
    expect(results[8]).toBe(14);
  });

  it('handles validation of percentage threshold', () => {
    expect(() => new FasterZigZag({deviation: 0})).toThrow();
    expect(() => new FasterZigZag({deviation: -5})).toThrow();
    expect(() => new FasterZigZag({deviation: 5})).not.toThrow();
  });

  it('correctly returns null for not enough data', () => {
    const zigzag = new FasterZigZag({deviation: 5});

    // First candle
    const result1 = zigzag.update({high: 10, low: 9}, false);
    expect(result1).toBeNull();

    // Second candle without significant change
    const result2 = zigzag.update({high: 10.2, low: 9.1}, false);
    expect(result2).toBeNull();

    // Third candle with still no significant change
    const result3 = zigzag.update({high: 10.3, low: 9.2}, false);
    expect(result3).toBeNull();
  });

  it('throws NotEnoughDataError when not enough data', () => {
    const zigzag = new FasterZigZag({deviation: 5});

    expect(() => zigzag.getResultOrThrow()).toThrow(NotEnoughDataError);

    // Add one candle, still not enough for a result
    zigzag.update({high: 10, low: 9}, false);
    expect(() => zigzag.getResultOrThrow()).toThrow(NotEnoughDataError);
  });

  it('correctly indicates stability when there is a confirmed extreme', () => {
    const zigzag = new FasterZigZag({deviation: 5});

    expect(zigzag.isStable).toBe(false);

    // First candle
    zigzag.update({high: 10, low: 9}, false);
    expect(zigzag.isStable).toBe(false);

    // Second candle with no significant change
    zigzag.update({high: 10.2, low: 9.8}, false);
    expect(zigzag.isStable).toBe(false);

    // Third candle with significant change
    zigzag.update({high: 7, low: 6}, false);
    expect(zigzag.isStable).toBe(true);
  });

  it('handles replace flag correctly', () => {
    const zigzag = new FasterZigZag({deviation: 5});

    // Add some initial data
    zigzag.update({high: 10, low: 9}, false); // Initial (not stable)
    zigzag.update({high: 11, low: 10}, false); // Higher high (not stable)
    zigzag.update({high: 8, low: 7}, false); // Significant drop (stable)

    // Now replace the latest candle with a different one
    const result = zigzag.update({high: 7.5, low: 6.5}, true);
    expect(result).toBe(11);
  });

  it('handles cases where a new high invalidates the current low swing', () => {
    const zigzag = new FasterZigZag({deviation: 5});

    // Setup a high and a significant drop
    zigzag.update({high: 10, low: 9}, false); // Initial
    zigzag.update({high: 12, low: 11}, false); // New high
    zigzag.update({high: 9, low: 8}, false); // Significant drop, confirms 12 as high

    // Get internal state
    expect(zigzag['lastExtreme']?.toString()).toBe('12');
    expect(zigzag['lastExtremeType']).toBe('high');

    // Now we're finding a low, but introduce a new higher high that invalidates our search for a low
    const result = zigzag.update({high: 13, low: 11}, false);

    // This should confirm the new high and invalidate our search for a low
    expect(result).toBe(13);
    expect(zigzag['lastExtreme']?.toString()).toBe('13');
    expect(zigzag['lastExtremeType']).toBe('high');
  });

  it('handles cases where a new low invalidates the current high swing', () => {
    const zigzag = new FasterZigZag({deviation: 5});

    // Setup a high and a significant drop to establish a low
    zigzag.update({high: 10, low: 9}, false); // Initial
    zigzag.update({high: 12, low: 11}, false); // New high
    zigzag.update({high: 9, low: 8}, false); // Significant drop, confirms 12 as high

    // Now introduce a rally that's not yet significant
    zigzag.update({high: 10, low: 9}, false); // Starting to rise

    // Check internal state
    expect(zigzag['lastExtreme']).toBe(8);
    expect(zigzag['lastExtremeType']).toBe('low');
    expect(zigzag['currentExtreme']).toBe(10);
    expect(zigzag['currentExtremeType']).toBe('high');

    // Now introduce a new lower low that invalidates our current search for a high
    const result = zigzag.update({high: 8, low: 7}, false);

    // This should confirm the new low and invalidate our search for a high
    expect(result).toBe(7);
    expect(zigzag['lastExtreme']).toBe(7);
    expect(zigzag['lastExtremeType']).toBe('low');
  });

  it('correctly handles zero values in percentage calculation', () => {
    const zigzag = new FasterZigZag({deviation: 5});

    // Access the private calculatePercentChange method
    const percentChange = (zigzag as any).calculatePercentChange(0, 10);
    expect(percentChange).toBe(0);
  });

  it('successfully returns result with getResultOrThrow when lastExtreme is not null', () => {
    const zigzag = new FasterZigZag({deviation: 5});

    // First, add enough candles to establish a confirmed ZigZag point
    // Add first candle
    zigzag.update({high: 100, low: 90}, false);

    // Add second candle with higher high
    zigzag.update({high: 110, low: 100}, false);

    // Add third candle with significant drop (>5%) to confirm the high
    const result = zigzag.update({high: 95, low: 85}, false);

    // Verify the result is the confirmed high extreme
    expect(result).toBe(110);

    // Verify internal state
    expect(zigzag['lastExtreme']).toBe(110);
    expect(zigzag['lastExtremeType']).toBe('high');

    // Now call getResultOrThrow which should hit line 330
    const throwResult = zigzag.getResultOrThrow();

    // Verify result matches the lastExtreme value
    expect(throwResult).toBe(110);

    // Add another candle with a more significant drop (> 20%)
    // to ensure it creates another ZigZag point
    const nextResult = zigzag.update({high: 70, low: 65}, false);

    // Verify we have a result (should still be 110 as we're tracking the low)
    expect(nextResult).toBe(110);

    // Add another candle with a significant rise to confirm the low
    const finalResult = zigzag.update({high: 100, low: 95}, false);

    // Now we should have a new result (the low at 65)
    expect(finalResult).toBe(65);

    // getResultOrThrow should now return the updated value
    const updatedThrowResult = zigzag.getResultOrThrow();
    expect(updatedThrowResult).toBe(65);
  });
});
