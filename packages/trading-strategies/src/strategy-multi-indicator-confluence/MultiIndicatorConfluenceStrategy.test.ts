import Big from 'big.js';
import {describe, expect, it} from 'vitest';
import {CandleBatcher, ExchangeOrderSide, ExchangeOrderType} from '@typedtrader/exchange';
import type {ExchangeCandle, TradingSessionState} from '@typedtrader/exchange';
import {MultiIndicatorConfluenceSchema, MultiIndicatorConfluenceStrategy} from './MultiIndicatorConfluenceStrategy.js';
import type {MultiIndicatorConfluenceConfig} from './MultiIndicatorConfluenceStrategy.js';

const defaultConfig: MultiIndicatorConfluenceConfig = {
  bollingerDeviationMultiplier: 2,
  bollingerPeriod: 5,
  emaLongPeriod: 5,
  emaShortPeriod: 3,
  macdLongPeriod: 5,
  macdShortPeriod: 3,
  macdSignalPeriod: 2,
  rsiOverbought: 70,
  rsiOversold: 30,
  rsiPeriod: 3,
};

/**
 * Config designed to make BUY/SELL signals fire:
 * - bollingerPeriod=1 means lower=upper=current price, so priceAtLowerBand and priceAtUpperBand are always true.
 * - rsiOverbought=80 allows RSI ~75 (steady zigzag rise) to pass the not-overbought check.
 * - rsiOversold=20 allows RSI ~25 (steady zigzag fall) to pass the not-oversold check.
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

const mockState: TradingSessionState = {
  baseBalance: new Big(0),
  counterBalance: new Big(1000),
  tradingRules: {
    base_increment: '0.0001',
    base_max_size: '100',
    base_min_size: '0.0001',
    counter_increment: '0.01',
    counter_min_size: '1',
    pair: {base: 'BTC', counter: 'USD'} as any,
  },
  feeRates: {
    [ExchangeOrderType.LIMIT]: new Big('0.0015'),
    [ExchangeOrderType.MARKET]: new Big('0.0025'),
  },
};

function makeExchangeCandle(close: number, index: number): ExchangeCandle {
  const closeStr = String(close);
  return {
    base: 'BTC',
    close: closeStr,
    counter: 'USD',
    high: closeStr,
    low: closeStr,
    open: closeStr,
    openTimeInISO: new Date(1735689600000 + index * 60000).toISOString(),
    openTimeInMillis: 1735689600000 + index * 60000,
    sizeInMillis: 60000,
    volume: '100',
  };
}

function makeBatchedCandle(close: number, index: number) {
  return CandleBatcher.createOneMinuteBatchedCandle([makeExchangeCandle(close, index)]);
}

/** Rising zigzag (+10/-5) that produces BUY signals with signalConfig */
function makeRisingZigzagPrices(count: number): number[] {
  const prices: number[] = [];
  let price = 100;
  for (let i = 0; i < count; i++) {
    price += i % 2 === 0 ? 10 : -5;
    prices.push(price);
  }
  return prices;
}

/** Falling zigzag (-10/+5) that produces SELL signals with signalConfig */
function makeFallingZigzagPrices(count: number): number[] {
  const prices: number[] = [];
  let price = 1000;
  for (let i = 0; i < count; i++) {
    price += i % 2 === 0 ? -10 : 5;
    prices.push(Math.max(price, 1));
  }
  return prices;
}

describe('MultiIndicatorConfluenceSchema', () => {
  it('accepts a valid configuration', () => {
    expect(() => MultiIndicatorConfluenceSchema.parse(defaultConfig)).not.toThrow();
  });

  it('rejects rsiOversold >= rsiOverbought', () => {
    expect(() =>
      MultiIndicatorConfluenceSchema.parse({...defaultConfig, rsiOversold: 70, rsiOverbought: 70})
    ).toThrow();
    expect(() =>
      MultiIndicatorConfluenceSchema.parse({...defaultConfig, rsiOversold: 80, rsiOverbought: 70})
    ).toThrow();
  });

  it('rejects emaShortPeriod >= emaLongPeriod', () => {
    expect(() =>
      MultiIndicatorConfluenceSchema.parse({...defaultConfig, emaShortPeriod: 5, emaLongPeriod: 5})
    ).toThrow();
    expect(() =>
      MultiIndicatorConfluenceSchema.parse({...defaultConfig, emaShortPeriod: 10, emaLongPeriod: 5})
    ).toThrow();
  });

  it('rejects macdShortPeriod >= macdLongPeriod', () => {
    expect(() =>
      MultiIndicatorConfluenceSchema.parse({...defaultConfig, macdShortPeriod: 5, macdLongPeriod: 5})
    ).toThrow();
    expect(() =>
      MultiIndicatorConfluenceSchema.parse({...defaultConfig, macdShortPeriod: 10, macdLongPeriod: 5})
    ).toThrow();
  });

  it('rejects rsiOverbought > 100', () => {
    expect(() => MultiIndicatorConfluenceSchema.parse({...defaultConfig, rsiOverbought: 101})).toThrow();
  });

  it('rejects rsiOversold > 100', () => {
    expect(() => MultiIndicatorConfluenceSchema.parse({...defaultConfig, rsiOversold: 101})).toThrow();
  });
});

describe('MultiIndicatorConfluenceStrategy', () => {
  it('reports correct requiredWarmupCandles', () => {
    const strategy = new MultiIndicatorConfluenceStrategy(defaultConfig);
    // max(emaLong=5, bollinger=5, macdLong+macdSignal=7, rsiPeriod+1=4) = 7
    expect(strategy.requiredWarmupCandles).toBe(7);
  });

  it('returns no advice during warmup period', async () => {
    const strategy = new MultiIndicatorConfluenceStrategy(defaultConfig);

    for (let i = 0; i < strategy.requiredWarmupCandles - 1; i++) {
      const advice = await strategy.onCandle(makeBatchedCandle(100 + i, i), mockState);
      expect(advice).toBeUndefined();
    }
  });

  it('does not throw when processing candles after warmup', async () => {
    const strategy = new MultiIndicatorConfluenceStrategy(defaultConfig);

    await expect(async () => {
      for (let i = 0; i < 20; i++) {
        await strategy.onCandle(makeBatchedCandle(100, i), mockState);
      }
    }).not.toThrow();
  });

  it('returns no advice when price is flat (no trend, no band touch)', async () => {
    const strategy = new MultiIndicatorConfluenceStrategy(defaultConfig);

    let lastAdvice;
    for (let i = 0; i < 20; i++) {
      lastAdvice = await strategy.onCandle(makeBatchedCandle(100, i), mockState);
    }

    // Flat price: EMAs are equal, MACD near zero, price in middle of BB → no signal
    expect(lastAdvice).toBeUndefined();
  });

  it('generates a BUY signal when EMA uptrend, bullish MACD, and price at lower band', async () => {
    const strategy = new MultiIndicatorConfluenceStrategy(signalConfig);

    const prices = makeRisingZigzagPrices(30);
    let buyAdvice;
    for (let i = 0; i < prices.length; i++) {
      const advice = await strategy.onCandle(makeBatchedCandle(prices[i], i), mockState);
      if (advice?.side === ExchangeOrderSide.BUY) {
        buyAdvice = advice;
        break;
      }
    }

    expect(buyAdvice).toBeDefined();
    expect(buyAdvice?.side).toBe(ExchangeOrderSide.BUY);
    expect(buyAdvice?.type).toBe(ExchangeOrderType.MARKET);
    expect(buyAdvice?.amountIn).toBe('counter');
  });

  it('generates a SELL signal when EMA downtrend, bearish MACD, and price at upper band', async () => {
    const strategy = new MultiIndicatorConfluenceStrategy(signalConfig);

    const prices = makeFallingZigzagPrices(30);
    let sellAdvice;
    for (let i = 0; i < prices.length; i++) {
      const advice = await strategy.onCandle(makeBatchedCandle(prices[i], i), mockState);
      if (advice?.side === ExchangeOrderSide.SELL) {
        sellAdvice = advice;
        break;
      }
    }

    expect(sellAdvice).toBeDefined();
    expect(sellAdvice?.side).toBe(ExchangeOrderSide.SELL);
    expect(sellAdvice?.type).toBe(ExchangeOrderType.MARKET);
    expect(sellAdvice?.amountIn).toBe('base');
  });

  it('includes indicator values in BUY signal reason', async () => {
    const strategy = new MultiIndicatorConfluenceStrategy(signalConfig);

    const prices = makeRisingZigzagPrices(30);
    let buyAdvice;
    for (let i = 0; i < prices.length; i++) {
      const advice = await strategy.onCandle(makeBatchedCandle(prices[i], i), mockState);
      if (advice?.side === ExchangeOrderSide.BUY) {
        buyAdvice = advice;
        break;
      }
    }

    expect(buyAdvice?.reason).toContain('EMA trend bullish');
    expect(buyAdvice?.reason).toContain('MACD momentum bullish');
    expect(buyAdvice?.reason).toContain('Bollinger Band');
    expect(buyAdvice?.reason).toContain('RSI');
  });

  it('tracks candlesProcessed correctly', async () => {
    const strategy = new MultiIndicatorConfluenceStrategy(defaultConfig);

    expect(strategy.candlesProcessed).toBe(0);

    for (let i = 0; i < 5; i++) {
      await strategy.onCandle(makeBatchedCandle(100, i), mockState);
    }

    expect(strategy.candlesProcessed).toBe(5);
  });

  it('isWarmedUp becomes true after requiredWarmupCandles', async () => {
    const strategy = new MultiIndicatorConfluenceStrategy(defaultConfig);

    expect(strategy.isWarmedUp).toBe(false);

    for (let i = 0; i < strategy.requiredWarmupCandles; i++) {
      await strategy.onCandle(makeBatchedCandle(100 + i, i), mockState);
    }

    expect(strategy.isWarmedUp).toBe(true);
  });

  it('RSI overbought boundary suppresses BUY when RSI >= rsiOverbought', async () => {
    // rsiOverbought=73 is below the ~75 RSI seen during zigzag rises → vetoes all BUY signals
    const config = {...signalConfig, rsiOverbought: 73};
    const strategy = new MultiIndicatorConfluenceStrategy(config);

    const prices = makeRisingZigzagPrices(30);
    let buyAdvice;
    for (let i = 0; i < prices.length; i++) {
      const advice = await strategy.onCandle(makeBatchedCandle(prices[i], i), mockState);
      if (advice?.side === ExchangeOrderSide.BUY) {
        buyAdvice = advice;
      }
    }

    expect(buyAdvice).toBeUndefined();
  });

  it('RSI oversold boundary suppresses SELL when RSI <= rsiOversold', async () => {
    // rsiOversold=27 is above the ~25 RSI seen during zigzag falls → vetoes all SELL signals
    const config = {...signalConfig, rsiOversold: 27};
    const strategy = new MultiIndicatorConfluenceStrategy(config);

    const prices = makeFallingZigzagPrices(30);
    let sellAdvice;
    for (let i = 0; i < prices.length; i++) {
      const advice = await strategy.onCandle(makeBatchedCandle(prices[i], i), mockState);
      if (advice?.side === ExchangeOrderSide.SELL) {
        sellAdvice = advice;
      }
    }

    expect(sellAdvice).toBeUndefined();
  });
});

describe('MultiIndicatorConfluenceStrategy NAME', () => {
  it('has the correct strategy name', () => {
    expect(MultiIndicatorConfluenceStrategy.NAME).toBe('@typedtrader/strategy-multi-indicator-confluence');
  });
});
