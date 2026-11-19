import {describe, expect, it, vi} from 'vitest';
import {TradingPair} from '@typedtrader/exchange';
import {warmUpFromHistory} from './warmUp.js';
import type {IndicatorHandle} from './types.js';

const pair = new TradingPair('BTC', 'USDT');

function handleWithWarmUp() {
  return {add: vi.fn(), getResult: vi.fn(), warmUp: vi.fn()} satisfies IndicatorHandle<number>;
}

describe('warmUpFromHistory', () => {
  it('says so when the bars a setting is derived from are not there', async () => {
    const report = vi.fn();
    const handle = handleWithWarmUp();

    await warmUpFromHistory({
      declarations: {offset: {history: {count: 30, interval: '1d'}}},
      handles: new Map([['offset', handle]]),
      market: {getRecentCandles: async () => []},
      pair,
      report,
    });

    expect(
      report,
      'a derived setting falling back to the config is the difference between judging an instrument and not'
    ).toHaveBeenCalledWith(expect.stringContaining('No 1d history available'));
    expect(handle.warmUp, 'the declaration still gets its turn to decide on nothing').toHaveBeenCalledWith([]);
  });

  it('says nothing when the bars are there', async () => {
    const report = vi.fn();

    await warmUpFromHistory({
      declarations: {offset: {history: {count: 1, interval: '1d'}}},
      handles: new Map([['offset', handleWithWarmUp()]]),
      market: {
        getRecentCandles: async () => [
          {
            base: 'BTC',
            close: '100',
            counter: 'USDT',
            high: '101',
            low: '99',
            open: '100',
            openTimeInISO: '2024-01-01T00:00:00.000Z',
            openTimeInMillis: 1704067200000,
            sizeInMillis: 86_400_000,
            volume: '1',
          },
        ],
      },
      pair,
      report,
    });

    expect(report).not.toHaveBeenCalled();
  });
});
