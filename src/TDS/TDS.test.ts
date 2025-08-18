import {TDS} from './TDS.js';

describe('TDS', () => {
  it('does not return a result for less than 9 prices', () => {
    const tds = new TDS();
    expect(tds.getRequiredInputs()).toBe(9);

    for (let i = 0; i < 8; i++) {
      const result = tds.add(10 + i);
      expect(result).toBeNull();
    }
  });

  it('returns 1 for a bullish setup after 9 consecutive closes > close 4 bars earlier', () => {
    const tds = new TDS();

    for (let i = 0; i < 4; i++) {
      tds.add(10);
    }

    let signal: number | null = null;

    for (let i = 0; i < 9; i++) {
      signal = tds.add(11 + i);
    }

    expect(signal).toBe(1);
  });

  it('returns -1 for a bearish setup after 9 consecutive closes < close 4 bars earlier', () => {
    const tds = new TDS();
    for (let i = 0; i < 4; i++) {
      tds.add(20);
    }
    let signal: number | null = null;
    for (let i = 0; i < 9; i++) {
      signal = tds.add(19 - i);
    }
    expect(signal).toBe(-1);
  });

  it('keeps at most 13 closes in the buffer', () => {
    const tds = new TDS();
    for (let i = 0; i < 20; i++) {
      tds.add(i);
    }
    expect(tds['closes'].length).toBeLessThanOrEqual(13);
  });

  it('detects a direction change from bearish to bullish', () => {
    const tds = new TDS();
    for (let i = 0; i < 4; i++) {
      tds.add(10);
    }
    tds.add(5);
    tds.add(4);
    tds.add(3);
    const result = tds.add(20);
    expect(tds['setupCount']).toBe(1);
    expect(tds['setupDirection']).toBe('bullish');
    expect(result).toBeNull();
  });

  it('detects a direction change from bullish to bearish', () => {
    const tds = new TDS();
    for (let i = 0; i < 4; i++) {
      tds.add(10);
    }
    tds.add(20);
    tds.add(21);
    tds.add(22);
    const result = tds.add(5);
    expect(tds['setupCount']).toBe(1);
    expect(tds['setupDirection']).toBe('bearish');
    expect(result).toBeNull();
  });

  describe('replace', () => {
    it('replaces values', () => {
      const tds = new TDS();
      for (let i = 0; i < 5; i++) {
        tds.add(10 + i);
      }
      // Now replace the last value
      const result = tds.replace(20);
      expect(result).toBeNull();
    });
  });
});
