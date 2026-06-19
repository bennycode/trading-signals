import Big from 'big.js';
import {describe, expect, it} from 'vitest';
import {AlpacaBroker, AlpacaBrokerMock, CandleBatcher, OrderSide, OrderType, TradingPair} from '@typedtrader/exchange';
import type {Candle, TradingSessionState} from '@typedtrader/exchange';
import {AtrTrailStrategy} from './AtrTrailStrategy.js';

const DAY = 86_400_000;
const pair = new TradingPair('STX', 'USD');

const heldState: TradingSessionState = {
  baseBalance: new Big(10),
  counterBalance: new Big(0),
  feeRates: {[OrderType.LIMIT]: new Big('0'), [OrderType.MARKET]: new Big('0')},
  tradingRules: {
    base_increment: '0.0001',
    base_max_size: '100000',
    base_min_size: '0.0001',
    counter_increment: '0.01',
    counter_min_size: '1',
    pair,
  },
};

function dailyCandle(index: number, close: number, high: number, low: number): Candle {
  const openTimeInMillis = Date.UTC(2026, 0, 1) + index * DAY;
  return {
    base: 'STX',
    close: String(close),
    counter: 'USD',
    high: String(high),
    low: String(low),
    open: String(close),
    openTimeInISO: new Date(openTimeInMillis).toISOString(),
    openTimeInMillis,
    sizeInMillis: DAY,
    volume: '1000',
  };
}

// 30 daily candles with a steady true range of 10 around a close of 100 → ATR ≈ 10 → ATR% ≈ 10%.
const warmupCandles = Array.from({length: 30}, (_unused, index) => dailyCandle(index, 100, 105, 95));

function toBatched(close: number, high: number, low: number) {
  return CandleBatcher.createOneMinuteBatchedCandle([dailyCandle(0, close, high, low)]);
}

/** A 1-minute candle stamped at a specific instant, for exercising the rolling daily-ATR batching. */
function minuteAt(openTimeInMillis: number, close: number, high: number, low: number) {
  const raw: Candle = {
    ...dailyCandle(0, close, high, low),
    openTimeInISO: new Date(openTimeInMillis).toISOString(),
    openTimeInMillis,
  };
  return CandleBatcher.createOneMinuteBatchedCandle([raw]);
}

function warmExchange() {
  const exchange = new AlpacaBrokerMock({
    balances: new Map([['STX', {available: new Big('10'), hold: new Big(0)}]]),
    tradingRules: AlpacaBroker.DEFAULT_CRYPTO_TRADING_RULES,
  });
  exchange.setHistoricalCandles(warmupCandles);
  return exchange;
}

describe('AtrTrailStrategy', () => {
  it('sizes the trail once from the historical ATR (multiple x ATR%)', async () => {
    const strategy = new AtrTrailStrategy({atrInterval: 14, atrMultiple: '2'});

    await strategy.init(warmExchange(), pair);

    // ATR settles at 10 on a close of 100 → 10% ATR; 2x → 20% trail.
    expect(new Big(strategy.trailState.trailDownPct ?? '0').toFixed(2), 'trail = 2 x 10% ATR').toBe('20.00');
  });

  it('holds without a stop when there is not enough history to size the ATR', async () => {
    const exchange = new AlpacaBrokerMock({
      balances: new Map([['STX', {available: new Big('10'), hold: new Big(0)}]]),
      tradingRules: AlpacaBroker.DEFAULT_CRYPTO_TRADING_RULES,
    });
    exchange.setHistoricalCandles([dailyCandle(0, 100, 105, 95)]);
    const strategy = new AtrTrailStrategy({atrInterval: 14, atrMultiple: '2'});

    await strategy.init(exchange, pair);

    expect(strategy.trailState.trailDownPct, 'no ATR -> no trail').toBeNull();
  });

  it('attaches on the first held candle and does not exit while price holds above the stop', async () => {
    const strategy = new AtrTrailStrategy({atrInterval: 14, atrMultiple: '2'});
    await strategy.init(warmExchange(), pair);

    // Attach: peak 200 → stop 160 (20% trail).
    expect(await strategy.onCandle(toBatched(195, 200, 190), heldState)).toBeUndefined();
    expect(strategy.trailState.peakPrice).toBe('200');
    expect(strategy.trailState.stopPrice).toBe('160');

    // Close 170 stays above the 160 stop → no exit.
    expect(await strategy.onCandle(toBatched(170, 198, 168), heldState)).toBeUndefined();
  });

  it('exits with a limit sell at the trail target when the close breaches the ATR-sized stop', async () => {
    const strategy = new AtrTrailStrategy({atrInterval: 14, atrMultiple: '2'});
    await strategy.init(warmExchange(), pair);

    await strategy.onCandle(toBatched(195, 200, 190), heldState); // attach, stop 160
    const advice = await strategy.onCandle(toBatched(155, 196, 150), heldState); // close 155 <= 160

    expect(advice?.side).toBe(OrderSide.SELL);
    expect(advice?.type).toBe(OrderType.LIMIT);
    if (advice?.type === OrderType.LIMIT) {
      expect(new Big(advice.price).toFixed(), 'limit price is the trail target').toBe('160');
    }
  });

  it('ratchets the stop up as the peak rises', async () => {
    const strategy = new AtrTrailStrategy({atrInterval: 14, atrMultiple: '2'});
    await strategy.init(warmExchange(), pair);

    await strategy.onCandle(toBatched(195, 200, 190), heldState); // peak 200, stop 160
    await strategy.onCandle(toBatched(245, 250, 240), heldState); // peak 250, stop 200

    expect(strategy.trailState.peakPrice).toBe('250');
    expect(strategy.trailState.stopPrice).toBe('200');
  });

  it('emits no advice before init has sized the trail', async () => {
    const strategy = new AtrTrailStrategy({atrInterval: 14, atrMultiple: '2'});

    expect(await strategy.onCandle(toBatched(155, 200, 150), heldState)).toBeUndefined();
    expect(strategy.trailState.peakPrice, 'no attach without a sized trail').toBe('0');
  });

  it('has the expected strategy name', () => {
    expect(AtrTrailStrategy.NAME).toBe('@typedtrader/strategy-atr-trail');
  });

  it('rolling: a daily ATR window does not move intraday on minute candles', async () => {
    const strategy = new AtrTrailStrategy({atrInterval: 14, atrMultiple: '2', rolling: true});
    await strategy.init(warmExchange(), pair);
    const sizedAtInit = strategy.trailState.trailDownPct;
    expect(sizedAtInit, 'init sized the trail').not.toBeNull();

    // Five wild swings, all within the same UTC day → the daily bar hasn't closed yet.
    const dayStart = Date.UTC(2026, 5, 1);
    for (let minute = 1; minute <= 5; minute++) {
      await strategy.onCandle(minuteAt(dayStart + minute * 60_000, 108, 130, 70), heldState);
    }

    expect(strategy.trailState.trailDownPct, 'a turbulent day still uses the prior days ATR window').toBe(sizedAtInit);
  });

  it('rolling: re-sizes the trail once a turbulent day closes', async () => {
    const strategy = new AtrTrailStrategy({atrInterval: 14, atrMultiple: '2', rolling: true});
    await strategy.init(warmExchange(), pair);
    const sizedAtInit = Number(strategy.trailState.trailDownPct);

    // Day 1 has a far wider range than the warm-up (~60 vs 10) but only counts once it closes.
    await strategy.onCandle(minuteAt(Date.UTC(2026, 5, 1), 100, 160, 100), heldState);
    expect(Number(strategy.trailState.trailDownPct), 'unchanged mid-day-1').toBe(sizedAtInit);

    // The day-2 candle completes day 1's bar → ATR rises → the trail widens.
    await strategy.onCandle(minuteAt(Date.UTC(2026, 5, 2), 100, 130, 95), heldState);
    expect(Number(strategy.trailState.trailDownPct), 'trail widened after the turbulent day closed').toBeGreaterThan(
      sizedAtInit
    );
  });
});
