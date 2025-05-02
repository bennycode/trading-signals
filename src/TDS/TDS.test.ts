import {TDS, FasterTDS} from './TDS.js';
import Big from 'big.js';

describe('TDS', () => {
  describe('replace', () => {
    it('replaces values', () => {
      const td = new TDS();

      for (let i = 0; i < 5; i++) {
        td.add(new Big(10 + i));
      }

      const result = td.replace(new Big(20));
      expect(result).toBeNull();
    });
  });

  it('does not return a result for less than 9 prices', () => {
    const td = new TDS();
    for (let i = 0; i < 8; i++) {
      const result = td.add(i);
      expect(result).toBeNull();
    }
  });

  it('returns 1 for a bullish setup after 9 consecutive closes > close 4 bars earlier', () => {
    const td = new TDS();
    // Seed with 4 values
    for (let i = 0; i < 4; i++) {
      td.add(new Big(10));
    }
    // Now 9 closes, each greater than 4 bars earlier
    let signal: Big | null = null;
    for (let i = 0; i < 9; i++) {
      signal = td.add(new Big(11 + i));
    }
    expect(signal?.eq(1)).toBe(true);
  });

  it('returns -1 for a bearish setup after 9 consecutive closes < close 4 bars earlier', () => {
    const td = new TDS();
    for (let i = 0; i < 4; i++) {
      td.add(new Big(20));
    }
    let signal: Big | null = null;
    for (let i = 0; i < 9; i++) {
      signal = td.add(new Big(19 - i));
    }
    expect(signal?.eq(-1)).toBe(true);
  });

  it('keeps at most 13 closes in the buffer (Big.js)', () => {
    const td = new TDS();

    for (let i = 0; i < 20; i++) {
      td.update(i, false);
    }

    // @ts-expect-error: accessing private property for test
    expect(td.closes.length).toBeLessThanOrEqual(13);
  });

  it('detects a direction change from bearish to bullish', () => {
    const td = new TDS();
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

  it('detects a direction change from bullish to bearish (Big.js)', () => {
    const td = new TDS();
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

describe('FasterTDS', () => {
  it('does not return a result for less than 9 prices', () => {
    const td = new FasterTDS();

    for (let i = 0; i < 8; i++) {
      const result = td.update(10 + i, false);
      expect(result).toBeNull();
    }
  });

  it('returns 1 for a bullish setup after 9 consecutive closes > close 4 bars earlier', () => {
    const td = new FasterTDS();

    for (let i = 0; i < 4; i++) {
      td.update(10, false);
    }

    let signal: number | null = null;

    for (let i = 0; i < 9; i++) {
      signal = td.update(11 + i, false);
    }

    expect(signal).toBe(1);
  });

  it('returns -1 for a bearish setup after 9 consecutive closes < close 4 bars earlier', () => {
    const td = new FasterTDS();
    for (let i = 0; i < 4; i++) {
      td.update(20, false);
    }
    let signal: number | null = null;
    for (let i = 0; i < 9; i++) {
      signal = td.update(19 - i, false);
    }
    expect(signal).toBe(-1);
  });

  it('keeps at most 13 closes in the buffer', () => {
    const td = new FasterTDS();
    for (let i = 0; i < 20; i++) {
      td.update(i, false);
    }
    // @ts-expect-error: accessing private property for test
    expect(td.closes.length).toBeLessThanOrEqual(13);
  });

  it('detects a direction change from bearish to bullish', () => {
    const td = new FasterTDS();
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

  it('detects a direction change from bullish to bearish', () => {
    const td = new FasterTDS();
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

  describe('replace', () => {
    it('should handle replace logic for number', () => {
      const td = new FasterTDS();
      for (let i = 0; i < 5; i++) {
        td.update(10 + i, false);
      }
      // Now replace the last value
      const result = td.update(20, true);
      expect(result).toBeNull();
    });
  });
});
