import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import Big from 'big.js';
import {describe, expect, it} from 'vitest';
import {z} from 'zod';
import {AlpacaBrokerMock, CandleSchema, OrderSide, TradingPair} from '@typedtrader/exchange';
import type {Candle} from '@typedtrader/exchange';
import {BacktestExecutor} from '../backtest/BacktestExecutor.js';
import type {BacktestConfig} from '../backtest/BacktestConfig.js';
import type {BacktestResult} from '../backtest/BacktestResult.js';
import type {TradingSessionStrategy} from '../trader/index.js';
import {MeanReversionStrategy} from './MeanReversionStrategy.js';
import {MeanReversion} from './meanReversion.js';

const tradingPair = new TradingPair('BTC', 'USDT');
const ONE_MINUTE_IN_MS = 60_000;

function loadCandles(): Candle[] {
  const file = join(import.meta.dirname, '../backtest/candles/BNB_USDT_2021_02_19_1_week.json');
  return z.array(CandleSchema).parse(JSON.parse(readFileSync(file, 'utf8')));
}

/** A run of identical one-minute candles, so the Bollinger Bands warm up without moving. */
function flatCandles(count: number, price: string, startAt = 0): Candle[] {
  return Array.from({length: count}, (_, index) => ({
    base: 'BTC',
    close: price,
    counter: 'USDT',
    high: price,
    low: price,
    open: price,
    openTimeInISO: new Date(startAt + index * ONE_MINUTE_IN_MS).toISOString(),
    openTimeInMillis: startAt + index * ONE_MINUTE_IN_MS,
    sizeInMillis: ONE_MINUTE_IN_MS,
    volume: '1',
  }));
}

function createBroker(options: {baseBalance: string; counterBalance: string}) {
  return new AlpacaBrokerMock({
    balances: new Map([
      ['BTC', {available: new Big(options.baseBalance), hold: new Big(0)}],
      ['USDT', {available: new Big(options.counterBalance), hold: new Big(0)}],
    ]),
  });
}

async function backtest(
  strategy: TradingSessionStrategy,
  candles: Candle[],
  balances: {baseBalance: string; counterBalance: string}
): Promise<BacktestResult> {
  const config: BacktestConfig = {broker: createBroker(balances), candles, strategy, tradingPair};
  return new BacktestExecutor(config).execute();
}

/** Trades reduced to what a trader would compare: direction, size and price, in order. */
function tradeLog(result: BacktestResult): string[] {
  return result.trades.map(trade => `${trade.side} ${trade.size.toFixed()} @ ${trade.price.toFixed()}`);
}

describe('MeanReversion', () => {
  const candles = loadCandles();
  const holdingFromTheStart = {baseBalance: '1', counterBalance: '0'};

  it('trades identically to the class it replaces', async () => {
    const legacy = await backtest(new MeanReversionStrategy({config: {}}), candles, holdingFromTheStart);
    const ported = await backtest(new MeanReversion(), candles, holdingFromTheStart);

    expect(tradeLog(ported), 'the ported rules reproduce the class trade for trade').toStrictEqual(tradeLog(legacy));
    expect(ported.trades.length, 'the week of candles actually produces trades to compare').toBeGreaterThan(0);
  });

  it('opens from flat without needing an unfillable sell first', async () => {
    /*
     * The class flips its phase when it emits advice rather than when the advice fills, so from
     * flat it first tries to sell a position it does not hold, and only buys once that phantom
     * sell has moved it to `waitingForRebuy`. The rules derive the phase from the balance, so the
     * first thing they do is open.
     */
    const flat = {baseBalance: '0', counterBalance: '50000'};
    const legacy = await backtest(new MeanReversionStrategy({config: {}}), candles, flat);
    const ported = await backtest(new MeanReversion(), candles, flat);

    expect(ported.trades[0]?.side, 'the rules open the position themselves').toBe(OrderSide.BUY);
    expect(
      ported.trades[0]?.openTimeInISO.localeCompare(legacy.trades[0]?.openTimeInISO ?? ''),
      'the rules enter at the first middle-band touch instead of waiting for an upper-band break'
    ).toBeLessThan(0);
  });

  it('stops out before the bands have warmed up', async () => {
    /*
     * The band rules need twenty hourly bars before they can judge anything. The stop reads only
     * the position, so it does not wait for them.
     */
    const candles = [...flatCandles(10, '100'), ...flatCandles(10, '98', 10 * ONE_MINUTE_IN_MS)];
    const strategy = new MeanReversion({stopLossPct: '1'});

    const result = await backtest(strategy, candles, holdingFromTheStart);

    expect(result.trades, 'the stop fires during warm-up').toHaveLength(1);
    expect(result.trades[0]?.advice.reason, 'and it is the stop that fired').toContain('Stop-loss');
  });

  it('stops out and then stays flat for good', async () => {
    // Twenty hourly bars of warm-up at 100, then a drop past the 1% stop.
    const warmUp = flatCandles(20 * 60, '100');
    const drop = flatCandles(60, '98', 20 * 60 * ONE_MINUTE_IN_MS);
    const strategy = new MeanReversion({stopLossPct: '1'});
    let finishedCount = 0;
    strategy.onFinish = () => {
      finishedCount++;
    };

    const result = await backtest(strategy, [...warmUp, ...drop], holdingFromTheStart);

    expect(result.trades, 'the stop sells once and nothing is bought back').toHaveLength(1);
    expect(result.trades[0]?.side).toBe(OrderSide.SELL);
    expect(result.trades[0]?.advice.reason, 'the stop-loss rule is the one that fired').toContain('Stop-loss');
    expect(strategy.ledger.lastExitFinal, 'the exit is recorded as terminal').toBe(true);
    expect(finishedCount, 'the runtime is told to tear the session down once').toBe(1);
  });
});
