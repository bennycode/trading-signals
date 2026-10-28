import {describe, expect, it} from 'vitest';
import {EODHDAPI, EODHDPeriod} from './EODHDAPI.js';

/**
 * These cover the arguments that never reach the network. EODHD answers a bad `period` or an
 * unparseable date with HTTP 200 and plausible data for a window nobody asked for, so refusing them
 * up front is the only way the mistake becomes visible.
 */
describe('EODHDAPI', {concurrent: false}, () => {
  const api = new EODHDAPI({apiKey: 'test-key'});

  describe('getEod', () => {
    it('refuses a period EODHD would silently replace with the daily default', async () => {
      await expect(
        api.getEod({period: 'zzz' as EODHDPeriod, symbol: 'ALV.XETRA'}),
        'a typo would otherwise come back as daily bars that look correct'
      ).rejects.toThrow(/silently falls back to daily bars/);
    });

    it.each(['28-10-2026', '2026/10/28', 'yesterday'])(
      'refuses the unparseable "from" date "%s"',
      async (from: string) => {
        await expect(api.getEod({from, period: EODHDPeriod.DAILY, symbol: 'ALV.XETRA'})).rejects.toThrow(
          /has to be YYYY-MM-DD/
        );
      }
    );

    it('refuses an unparseable "to" date', async () => {
      await expect(api.getEod({period: EODHDPeriod.DAILY, symbol: 'ALV.XETRA', to: '2026-13'})).rejects.toThrow(
        /"to" has to be YYYY-MM-DD/
      );
    });
  });
});
