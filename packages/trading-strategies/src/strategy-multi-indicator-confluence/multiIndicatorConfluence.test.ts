import {describe, expect, it} from 'vitest';
import {OrderSide} from '@typedtrader/exchange';
import {backtest, candlesAt, flatWithCash, holdingFromTheStart} from '../engine/testing.js';
import {MultiIndicatorConfluence, MultiIndicatorConfluenceSchema} from './multiIndicatorConfluence.js';
import type {MultiIndicatorConfluenceConfig} from './multiIndicatorConfluence.js';

/**
 * Short periods and a one-bar Bollinger Band, which makes the band touch always true, so a
 * zigzag is enough to line all four readings up. Taken from the tests of the class this replaces.
 */
const signalConfig: MultiIndicatorConfluenceConfig = {
  bollingerDeviationMultiplier: 2,
  bollingerPeriod: 1,
  emaLongPeriod: 5,
  emaShortPeriod: 3,
  macdLongPeriod: 5,
  macdShortPeriod: 3,
  macdSignalPeriod: 2,
  rsiOverbought: 80,
  rsiOversold: 20,
  rsiPeriod: 3,
};

/** A zigzag that trends in `direction` while giving RSI the pullbacks it needs to stay moderate. */
function zigzag(count: number, start: number, direction: 'down' | 'up'): string[] {
  const [step, pullback] = direction === 'up' ? [10, -5] : [-10, 5];
  let price = start;
  return Array.from({length: count}, (_, index) => {
    price = Math.max(price + (index % 2 === 0 ? step : pullback), 1);
    return String(price);
  });
}

describe('MultiIndicatorConfluence', () => {
  it('buys where trend, momentum, band and RSI all agree', async () => {
    const result = await backtest(
      new MultiIndicatorConfluence(signalConfig),
      candlesAt(zigzag(40, 100, 'up')),
      flatWithCash
    );

    expect(result.trades.length, 'a rising zigzag lines the four readings up').toBeGreaterThan(0);
    expect(result.trades[0]?.side).toBe(OrderSide.BUY);
    expect(result.trades[0]?.advice.reason, 'the reason names every reading that agreed').toMatch(
      /EMA trend bullish.+MACD momentum bullish.+lower Bollinger Band.+RSI .+not overbought/
    );
  });

  it('sells where all four turn the other way', async () => {
    const result = await backtest(
      new MultiIndicatorConfluence(signalConfig),
      candlesAt(zigzag(40, 1000, 'down')),
      holdingFromTheStart
    );

    expect(result.trades.length, 'a falling zigzag turns every reading bearish').toBeGreaterThan(0);
    expect(result.trades[0]?.side).toBe(OrderSide.SELL);
    expect(result.trades[0]?.advice.reason, 'the reason names every reading that agreed').toMatch(
      /EMA trend bearish.+MACD momentum bearish.+upper Bollinger Band.+RSI .+not oversold/
    );
  });

  it('rejects a config whose periods contradict each other', () => {
    expect(
      () => MultiIndicatorConfluenceSchema.parse({...signalConfig, emaShortPeriod: 30}),
      'a short EMA longer than the long one is not a trend reading'
    ).toThrow();
  });
});
