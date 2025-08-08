import {TDS} from './TDS.js';
import Big from 'big.js';

describe('TDS', () => {
  describe('replace', () => {
    it('replaces values', () => {
      const tds = new TDS();

      for (let i = 0; i < 5; i++) {
        tds.add(new Big(10 + i));
      }

      const result = tds.replace(new Big(20));
      expect(result).toBeNull();
    });
  });

  it('does not return a result for less than 9 prices', () => {
    const tds = new TDS();
    expect(tds.getRequiredInputs()).toBe(9);
    for (let i = 0; i < 8; i++) {
      const result = tds.add(i);
      expect(result).toBeNull();
    }
  });

  it('returns 1 for a bullish setup after 9 consecutive closes > close 4 bars earlier', () => {
    const tds = new TDS();
    // Seed with 4 values
    for (let i = 0; i < 4; i++) {
      tds.add(new Big(10));
    }
    // Now 9 closes, each greater than 4 bars earlier
    let signal: Big | null = null;
    for (let i = 0; i < 9; i++) {
      signal = tds.add(new Big(11 + i));
    }
    expect(signal?.eq(1)).toBe(true);
  });

  it('returns -1 for a bearish setup after 9 consecutive closes < close 4 bars earlier', () => {
    const tds = new TDS();
    for (let i = 0; i < 4; i++) {
      tds.add(new Big(20));
    }
    let signal: Big | null = null;
    for (let i = 0; i < 9; i++) {
      signal = tds.add(new Big(19 - i));
    }
    expect(signal?.eq(-1)).toBe(true);
  });

  it('keeps at most 13 closes in the buffer (Big.js)', () => {
    const tds = new TDS();

    for (let i = 0; i < 20; i++) {
      tds.update(i, false);
    }

    expect(tds['closes'].length).toBeLessThanOrEqual(13);
  });

  it('detects a direction change from bearish to bullish', () => {
    const tds = new TDS();
    // Seed with 4 values
    for (let i = 0; i < 4; i++) {
      tds.update(new Big(10), false);
    }
    // 3 bearish closes
    tds.update(new Big(5), false);
    tds.update(new Big(4), false);
    tds.update(new Big(3), false);
    // Now a bullish close (greater than close 4 bars earlier)
    const result = tds.update(new Big(20), false);
    expect(tds['setupCount']).toBe(1);
    expect(tds['setupDirection']).toBe('bullish');
    expect(result).toBeNull();
  });

  it('detects a direction change from bullish to bearish (Big.js)', () => {
    const tds = new TDS();
    // Seed with 4 values
    for (let i = 0; i < 4; i++) {
      tds.update(new Big(10), false);
    }
    // 3 bullish closes
    tds.update(new Big(20), false);
    tds.update(new Big(21), false);
    tds.update(new Big(22), false);
    // Now a bearish close (less than close 4 bars earlier)
    const result = tds.update(new Big(5), false);
    // After direction change, setupCount should be 1 and setupDirection should be 'bearish'
    expect(tds['setupCount']).toBe(1);
    expect(tds['setupDirection']).toBe('bearish');
    expect(result).toBeNull();
  });
});

describe('FasterTDS', () => {
  it('does not return a result for less than 9 prices', () => {
    const tds = new FasterTDS();
    expect(tds.getRequiredInputs()).toBe(9);

    for (let i = 0; i < 8; i++) {
      const result = tds.update(10 + i, false);
      expect(result).toBeNull();
    }
  });

  it('returns 1 for a bullish setup after 9 consecutive closes > close 4 bars earlier', () => {
    const tds = new FasterTDS();

    for (let i = 0; i < 4; i++) {
      tds.update(10, false);
    }

    let signal: number | null = null;

    for (let i = 0; i < 9; i++) {
      signal = tds.update(11 + i, false);
    }

    expect(signal).toBe(1);
  });

  it('returns -1 for a bearish setup after 9 consecutive closes < close 4 bars earlier', () => {
    const tds = new FasterTDS();
    for (let i = 0; i < 4; i++) {
      tds.update(20, false);
    }
    let signal: number | null = null;
    for (let i = 0; i < 9; i++) {
      signal = tds.update(19 - i, false);
    }
    expect(signal).toBe(-1);
  });

  it('keeps at most 13 closes in the buffer', () => {
    const tds = new FasterTDS();
    for (let i = 0; i < 20; i++) {
      tds.update(i, false);
    }
    expect(tds['closes'].length).toBeLessThanOrEqual(13);
  });

  it('detects a direction change from bearish to bullish', () => {
    const tds = new FasterTDS();
    for (let i = 0; i < 4; i++) {
      tds.update(10, false);
    }
    tds.update(5, false);
    tds.update(4, false);
    tds.update(3, false);
    const result = tds.update(20, false);
    expect(tds['setupCount']).toBe(1);
    expect(tds['setupDirection']).toBe('bullish');
    expect(result).toBeNull();
  });

  it('detects a direction change from bullish to bearish', () => {
    const tds = new FasterTDS();
    for (let i = 0; i < 4; i++) {
      tds.update(10, false);
    }
    tds.update(20, false);
    tds.update(21, false);
    tds.update(22, false);
    const result = tds.update(5, false);
    expect(tds['setupCount']).toBe(1);
    expect(tds['setupDirection']).toBe('bearish');
    expect(result).toBeNull();
  });

  describe('replace', () => {
    it('should handle replace logic for number', () => {
      const tds = new FasterTDS();
      for (let i = 0; i < 5; i++) {
        tds.update(10 + i, false);
      }
      // Now replace the last value
      const result = tds.update(20, true);
      expect(result).toBeNull();
    });
  });
});
