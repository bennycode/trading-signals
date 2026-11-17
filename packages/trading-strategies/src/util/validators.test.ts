import {describe, expect, it} from 'vitest';
import {timeframeString} from './validators.js';

describe('timeframeString', () => {
  it('accepts a bar size the candle batcher can work with', () => {
    expect(timeframeString.safeParse('5m').success).toBe(true);
  });

  it('refuses a bar size smaller than the candles a strategy receives', () => {
    expect(timeframeString.safeParse('30s').success, 'a strategy never sees anything below a minute').toBe(false);
  });

  it('refuses a duration it cannot read rather than throwing', () => {
    for (const value of ['', 'nonsense', 'm', '1 banana']) {
      const result = timeframeString.safeParse(value);

      expect(result.success, `${JSON.stringify(value)} is an invalid config, not an exception`).toBe(false);
    }
  });

  it('refuses something that is not a string at all', () => {
    expect(timeframeString.safeParse(60_000).success).toBe(false);
  });
});
