import {TDS} from './TDS.js';
import {TradingSignal} from '../../base/index.js';

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

  it('handles close equal to previous 4 without changing setup', () => {
    const tds = new TDS();
    const prev4 = 10;

    for (let i = 0; i < 4; i++) {
      tds.add(prev4);
    }

    tds.add(15);
    tds.add(16);

    // Current setup should be bullish with count 2
    expect(tds['setupCount']).toBe(2);
    expect(tds['setupDirection']).toBe('bullish');

    // Add a close equal to "prev4" (10 === 10)
    const result = tds.add(prev4);

    // Setup count and direction should remain unchanged
    expect(tds['setupCount']).toBe(2);
    expect(tds['setupDirection']).toBe('bullish');
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

    it('changes nothing when the latest close is replaced with the same value', () => {
      const tds = new TDS();
      const closes = [10, 10, 10, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19] as const;

      closes.forEach(close => tds.add(close));

      const resultBefore = tds.getResult();
      const countBefore = tds['setupCount'];
      const directionBefore = tds['setupDirection'];

      tds.replace(19);

      expect(tds.getResult(), 'replacing a close with itself is a no-op').toBe(resultBefore);
      expect(tds['setupCount'], 'and leaves the setup count alone').toBe(countBefore);
      expect(tds['setupDirection'], 'and the setup direction').toBe(directionBefore);
    });

    it('does not advance the setup count twice for the same bar', () => {
      const tds = new TDS();

      for (let i = 0; i < 4; i++) {
        tds.add(10);
      }

      tds.add(15);
      tds.add(16);

      expect(tds['setupCount'], 'two bars closed above the close four bars earlier').toBe(2);

      tds.replace(17);

      expect(tds['setupCount'], 'replacing the second bar must not count it again').toBe(2);
      expect(tds['setupDirection']).toBe('bullish');
    });

    it('restores the setup direction when a replacement reverses the bar', () => {
      const tds = new TDS();

      for (let i = 0; i < 4; i++) {
        tds.add(10);
      }

      tds.add(15);
      tds.add(16);
      tds.replace(5);

      expect(tds['setupCount'], 'a bearish bar restarts the count').toBe(1);
      expect(tds['setupDirection'], 'the direction flips with the replaced bar').toBe('bearish');
    });

    it('matches an equivalent series that never used replace', () => {
      const closes = [10, 10, 10, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19] as const;

      const replaced = new TDS();
      closes.slice(0, -1).forEach(close => replaced.add(close));
      replaced.add(99);
      replaced.replace(closes[closes.length - 1]);

      const reference = new TDS();
      closes.forEach(close => reference.add(close));

      expect(replaced.getResult(), 'a replacement must reproduce the add-only series').toBe(reference.getResult());
      expect(replaced['setupCount']).toBe(reference['setupCount']);
      expect(replaced['setupDirection']).toBe(reference['setupDirection']);
    });

    it('keeps an earlier setup when the replaced bar completed nothing', () => {
      const tds = new TDS();

      for (let i = 0; i < 4; i++) {
        tds.add(10);
      }

      for (let i = 0; i < 9; i++) {
        tds.add(11 + i);
      }

      expect(tds.getResult(), 'nine rising bars complete a bullish setup').toBe(1);

      // Neither of these bars completes a setup, so the earlier result stands.
      tds.add(5);
      tds.replace(6);

      expect(tds.getResult(), 'replacing a bar that emitted nothing must not withdraw an older setup').toBe(1);
    });

    it('withdraws a completed setup when the replacement breaks it', () => {
      const tds = new TDS();

      for (let i = 0; i < 4; i++) {
        tds.add(10);
      }

      for (let i = 0; i < 8; i++) {
        tds.add(11 + i);
      }

      expect(tds.getResult(), 'eight bars are one short of a completed setup').toBeNull();

      expect(tds.add(19), 'the ninth consecutive bar completes the bullish setup').toBe(1);

      tds.replace(5);

      expect(tds.getResult(), 'the setup no longer completes, so the emission is withdrawn').toBeNull();
    });
  });

  describe('getSignal', () => {
    it('returns UNKNOWN when there is no result', () => {
      const tds = new TDS();
      const signal = tds.getSignal();
      expect(signal.state).toBe(TradingSignal.UNKNOWN);
    });

    it('returns OVERBOUGHT when TDS = 1 (bullish setup completed)', () => {
      const tds = new TDS();

      for (let i = 0; i < 4; i++) {
        tds.add(10);
      }

      for (let i = 0; i < 9; i++) {
        tds.add(11 + i);
      }

      const signal = tds.getSignal();

      expect(tds.getResultOrThrow()).toBe(1);
      expect(signal.state).toBe(TradingSignal.BULLISH);
    });

    it('returns OVERSOLD when TDS = -1 (bearish setup completed)', () => {
      const tds = new TDS();

      for (let i = 0; i < 4; i++) {
        tds.add(20);
      }

      for (let i = 0; i < 9; i++) {
        tds.add(19 - i);
      }

      const signal = tds.getSignal();

      expect(tds.getResultOrThrow()).toBe(-1);
      expect(signal.state).toBe(TradingSignal.BEARISH);
    });
  });
});
