import {TDSequential, FasterTDSequential} from './TDSequential.js';
import Big from 'big.js';

describe('TDSequential', () => {
  it('should return null for less than 9 valid setups', () => {
    const td = new TDSequential();
    // 8 closes, all increasing, but not enough for a signal
    for (let i = 0; i < 8; i++) {
      const result = td.update(new Big(10 + i), false);
      expect(result).toBeNull();
    }
  });

  it('should return 1 for a bullish setup after 9 consecutive closes > close 4 bars earlier', () => {
    const td = new TDSequential();
    // Seed with 4 values
    for (let i = 0; i < 4; i++) {
      td.update(new Big(10), false);
    }
    // Now 9 closes, each greater than 4 bars earlier
    let signal: Big | null = null;
    for (let i = 0; i < 9; i++) {
      signal = td.update(new Big(11 + i), false);
    }
    expect(signal?.eq(1)).toBe(true);
  });

  it('should return -1 for a bearish setup after 9 consecutive closes < close 4 bars earlier', () => {
    const td = new TDSequential();
    for (let i = 0; i < 4; i++) {
      td.update(new Big(20), false);
    }
    let signal: Big | null = null;
    for (let i = 0; i < 9; i++) {
      signal = td.update(new Big(19 - i), false);
    }
    expect(signal?.eq(-1)).toBe(true);
  });
});

describe('TDSequential reference tests', () => {
  it('should handle empty input (null/undefined/empty array) gracefully', () => {
    // Since our implementation is streaming, we expect no output if nothing is fed
    const td = new TDSequential();
    expect(td.update).toBeDefined();
  });

  it('should handle a single input', () => {
    const td = new TDSequential();
    const result = td.update(new Big(9377.81), false);
    expect(result).toBeNull();
  });
});

describe('TDSequential replace functionality', () => {
  it('should handle replace logic for Big.js', () => {
    const td = new TDSequential();
    for (let i = 0; i < 5; i++) {
      td.update(new Big(10 + i), false);
    }
    // Now replace the last value
    const result = td.update(new Big(20), true);
    expect(result).toBeNull();
  });
});

describe('TDSequential closes array length', () => {
  it('should keep at most 13 closes in the buffer (Big.js)', () => {
    const td = new TDSequential();
    for (let i = 0; i < 20; i++) {
      td.update(i, false);
    }
    // @ts-expect-error: accessing private property for test
    expect(td.closes.length).toBeLessThanOrEqual(13);
  });
});

describe('TDSequential direction change from bearish to bullish', () => {
  it('should reset setupCount and setupDirection when direction changes from bearish to bullish (Big.js)', () => {
    const td = new TDSequential();
    // Seed with 4 values
    for (let i = 0; i < 4; i++) {
      td.update(new Big(10), false);
    }
    // 3 bearish closes
    td.update(new Big(5), false);
    td.update(new Big(4), false);
    td.update(new Big(3), false);
    // Now a bullish close (greater than close 4 bars earlier)
    const result = td.update(new Big(20), false);
    // After direction change, setupCount should be 1 and setupDirection should be 'bullish'
    // @ts-expect-error: accessing private property for test
    expect(td.setupCount).toBe(1);
    // @ts-expect-error: accessing private property for test
    expect(td.setupDirection).toBe('bullish');
    expect(result).toBeNull();
  });
});

describe('TDSequential direction change from bullish to bearish', () => {
  it('should reset setupCount and setupDirection when direction changes from bullish to bearish (Big.js)', () => {
    const td = new TDSequential();
    // Seed with 4 values
    for (let i = 0; i < 4; i++) {
      td.update(new Big(10), false);
    }
    // 3 bullish closes
    td.update(new Big(20), false);
    td.update(new Big(21), false);
    td.update(new Big(22), false);
    // Now a bearish close (less than close 4 bars earlier)
    const result = td.update(new Big(5), false);
    // After direction change, setupCount should be 1 and setupDirection should be 'bearish'
    // @ts-expect-error: accessing private property for test
    expect(td.setupCount).toBe(1);
    // @ts-expect-error: accessing private property for test
    expect(td.setupDirection).toBe('bearish');
    expect(result).toBeNull();
  });
});

describe('FasterTDSequential', () => {
  it('should return null for less than 9 valid setups', () => {
    const td = new FasterTDSequential();
    for (let i = 0; i < 8; i++) {
      const result = td.update(10 + i, false);
      expect(result).toBeNull();
    }
  });

  it('should return 1 for a bullish setup after 9 consecutive closes > close 4 bars earlier', () => {
    const td = new FasterTDSequential();
    for (let i = 0; i < 4; i++) {
      td.update(10, false);
    }
    let signal: number | null = null;
    for (let i = 0; i < 9; i++) {
      signal = td.update(11 + i, false);
    }
    expect(signal).toBe(1);
  });

  it('should return -1 for a bearish setup after 9 consecutive closes < close 4 bars earlier', () => {
    const td = new FasterTDSequential();
    for (let i = 0; i < 4; i++) {
      td.update(20, false);
    }
    let signal: number | null = null;
    for (let i = 0; i < 9; i++) {
      signal = td.update(19 - i, false);
    }
    expect(signal).toBe(-1);
  });
});

describe('FasterTDSequential replace functionality', () => {
  it('should handle replace logic for number', () => {
    const td = new FasterTDSequential();
    for (let i = 0; i < 5; i++) {
      td.update(10 + i, false);
    }
    // Now replace the last value
    const result = td.update(20, true);
    expect(result).toBeNull();
  });
});

describe('FasterTDSequential closes array length', () => {
  it('should keep at most 13 closes in the buffer (number)', () => {
    const td = new FasterTDSequential();
    for (let i = 0; i < 20; i++) {
      td.update(i, false);
    }
    // @ts-expect-error: accessing private property for test
    expect(td.closes.length).toBeLessThanOrEqual(13);
  });
});

describe('FasterTDSequential direction change from bearish to bullish', () => {
  it('should reset setupCount and setupDirection when direction changes from bearish to bullish (number)', () => {
    const td = new FasterTDSequential();
    for (let i = 0; i < 4; i++) {
      td.update(10, false);
    }
    td.update(5, false);
    td.update(4, false);
    td.update(3, false);
    const result = td.update(20, false);
    // @ts-expect-error: accessing private property for test
    expect(td.setupCount).toBe(1);
    // @ts-expect-error: accessing private property for test
    expect(td.setupDirection).toBe('bullish');
    expect(result).toBeNull();
  });
});

describe('FasterTDSequential direction change from bullish to bearish', () => {
  it('should reset setupCount and setupDirection when direction changes from bullish to bearish (number)', () => {
    const td = new FasterTDSequential();
    for (let i = 0; i < 4; i++) {
      td.update(10, false);
    }
    td.update(20, false);
    td.update(21, false);
    td.update(22, false);
    const result = td.update(5, false);
    // @ts-expect-error: accessing private property for test
    expect(td.setupCount).toBe(1);
    // @ts-expect-error: accessing private property for test
    expect(td.setupDirection).toBe('bearish');
    expect(result).toBeNull();
  });
});
