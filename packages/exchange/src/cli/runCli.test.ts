import {EventEmitter} from 'node:events';
import {spawnSync} from 'node:child_process';
import Big from 'big.js';
import {describe, expect, it, vi} from 'vitest';
import type {Broker, Candle, Fill} from '../broker/Broker.js';
import {OrderPosition, OrderSide, OrderType} from '../broker/Broker.js';
import type {MarketDataSource} from '../broker/MarketDataSource.js';
import {TradingPair} from '../broker/TradingPair.js';
import {createCliBroker} from './cliBroker.js';
import {runCli, USAGE, type CliDeps} from './runCli.js';

const PAIR = new TradingPair('AAPL', 'USD');
const CANDLE: Candle = {
  base: 'AAPL',
  close: '100',
  counter: 'USD',
  high: '101',
  low: '99',
  open: '100',
  openTimeInISO: '2026-09-09T10:00:00.000Z',
  openTimeInMillis: 1788948000000,
  sizeInMillis: 60_000,
  volume: '10',
};
const FILL: Fill = {
  created_at: CANDLE.openTimeInISO,
  fee: '0',
  feeAsset: 'USD',
  order_id: '42',
  pair: PAIR,
  position: OrderPosition.LONG,
  price: '100',
  side: OrderSide.BUY,
  size: '1',
};
const INSTRUMENTS = [{currency: 'GBX', isin: 'GB00B63H8491', name: 'Rolls-Royce', ticker: 'RRl_EQ'}];

function setup() {
  const broker = Object.assign(new EventEmitter(), {
    cancelOpenOrders: vi.fn<Broker['cancelOpenOrders']>().mockResolvedValue(['42', '43']),
    cancelOrderById: vi.fn<Broker['cancelOrderById']>().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    estimateFee: vi.fn<Broker['estimateFee']>().mockResolvedValue({
      commission: new Big(0),
      currencyConversion: new Big(0),
      feeAsset: 'USD',
      total: new Big(0),
    }),
    getFillByOrderId: vi.fn<Broker['getFillByOrderId']>().mockResolvedValue(undefined),
    getFills: vi.fn<Broker['getFills']>().mockResolvedValue([FILL]),
    getLatestCandle: vi.fn<MarketDataSource['getLatestCandle']>().mockResolvedValue(CANDLE),
    getOpenOrders: vi.fn<Broker['getOpenOrders']>().mockResolvedValue([]),
    getRecentCandles: vi.fn<MarketDataSource['getRecentCandles']>().mockResolvedValue([CANDLE]),
    getSmallestInterval: vi.fn().mockReturnValue(60_000),
    getTime: vi.fn<Broker['getTime']>().mockResolvedValue(CANDLE.openTimeInISO),
    getTradingRules: vi.fn<Broker['getTradingRules']>().mockResolvedValue({
      base_increment: '0.1',
      base_max_size: '100',
      base_min_size: '0.1',
      counter_increment: '0.01',
      counter_min_size: '1',
      pair: PAIR,
    }),
    listBalances: vi.fn<Broker['listBalances']>().mockResolvedValue([]),
    placeLimitOrder: vi.fn<Broker['placeLimitOrder']>(),
    placeMarketOrder: vi.fn<Broker['placeMarketOrder']>(),
    unwatchCandles: vi.fn(),
    unwatchOrders: vi.fn(),
    verifyCredentials: vi.fn<Broker['verifyCredentials']>().mockResolvedValue(undefined),
    watchCandles: vi.fn<MarketDataSource['watchCandles']>().mockResolvedValue('candles'),
    watchOrders: vi.fn<Broker['watchOrders']>().mockResolvedValue('orders'),
  });
  const listInstruments = vi.fn().mockResolvedValue(INSTRUMENTS);
  const deps = {
    createBroker: vi.fn<CliDeps['createBroker']>().mockReturnValue({
      broker: broker as unknown as Broker & MarketDataSource,
      listInstruments,
    }),
    env: {},
    writeEvent: vi.fn<CliDeps['writeEvent']>(),
  };
  const run = (args: string[]) => runCli([...args, '--broker', 'alpaca'], deps);
  return {broker, deps, listInstruments, run};
}

describe('runCli', () => {
  it.each([[], ['help'], ['--help']])('shows help without constructing a broker: %j', async (...args) => {
    const {deps} = setup();
    expect(await runCli(args, deps)).toEqual({text: USAGE});
    expect(deps.createBroker).not.toHaveBeenCalled();
  });

  it.each([
    ['unknown'],
    ['toString'],
    ['buy', 'AAPL'],
    ['buy', 'AAPL', '1', 'extra'],
    ['buy', 'AAPL', '0'],
    ['buy', 'AAPL', '--', '-1'],
    ['buy', 'AAPL', 'NaN'],
    ['buy', 'AAPL', '1', '--limit', '0'],
    ['buy', 'AAPL', '1', '--limit', ''],
    ['buy', 'AAPL', '1', '--all'],
    ['cancel', 'AAPL', '42', '--dry-run'],
    ['cancel', 'AAPL', '42', '--all'],
    ['candles', 'AAPL', '--count', '0'],
    ['candles', 'AAPL', '--interval', '0m'],
    ['candles', 'AAPL', '--interval', 'banana'],
    ['wait', 'AAPL', '42', '--poll', '0s'],
    ['wait', 'AAPL', '42', '--poll', ''],
    ['wait', 'AAPL', '42', '--timeout', '99w'],
    ['watch-orders', '--take', '1.5'],
    ['watch-orders', '--take', ''],
  ])('rejects invalid input before constructing a broker: %j', async (...args) => {
    const {deps, run} = setup();
    await expect(run(args)).rejects.toThrow();
    expect(deps.createBroker).not.toHaveBeenCalled();
  });

  it('requires an explicit supported broker', async () => {
    await expect(runCli(['balances'])).rejects.toThrow('--broker');
    await expect(runCli(['balances', '--broker', 'binance'])).rejects.toThrow('--broker');
  });

  it('defaults to paper even if an environment flag requests live', async () => {
    const {deps, run} = setup();
    deps.env = {ALPACA_USE_PAPER: 'false'};
    await run(['balances']);
    expect(deps.createBroker).toHaveBeenCalledWith('alpaca', false, deps.env);
    await run(['balances', '--live']);
    expect(deps.createBroker).toHaveBeenLastCalledWith('alpaca', true, deps.env);
  });

  it('selects only the requested environment credentials', () => {
    const env = {ALPACA_LIVE_API_KEY: 'live-key', ALPACA_LIVE_API_SECRET: 'live-secret'};
    expect(() => createCliBroker('alpaca', false, env)).toThrow('ALPACA_PAPER_API_KEY');
    expect(() => createCliBroker('trading212', true, {})).toThrow('TRADING212_LIVE_API_KEY');
  });

  it('verifies credentials and labels the selected mode', async () => {
    const {broker, run} = setup();
    expect(await run(['verify'])).toEqual({json: {broker: 'Alpaca', environment: 'paper', ok: true}});
    expect(broker.verifyCredentials).toHaveBeenCalledOnce();
  });

  it.each(['rolls', 'rRl_EQ', 'GB00B63H8491'])('searches instrument names, tickers and ISINs: %s', async query => {
    const {run} = setup();
    expect(await run(['instruments', query])).toEqual({json: INSTRUMENTS});
  });

  it('resolves Trading212 currency before placing an order', async () => {
    const {broker, deps} = setup();
    await runCli(['buy', 'RRl_EQ', '1', '--broker', 'trading212'], deps);
    expect(broker.placeMarketOrder).toHaveBeenCalledWith(new TradingPair('RRl_EQ', 'GBX'), {
      side: OrderSide.BUY,
      size: '1',
      sizeInCounter: false,
    });
  });

  it('passes limit orders through and skips metadata with --counter', async () => {
    const {broker, listInstruments, run} = setup();
    await run(['sell', 'AAPL', '1.2', '--limit', '150', '--counter', 'USD']);
    expect(broker.placeLimitOrder).toHaveBeenCalledWith(PAIR, {price: '150', side: OrderSide.SELL, size: '1.2'});
    expect(listInstruments).not.toHaveBeenCalled();
  });

  it('rejects unknown Trading212 symbols before submission', async () => {
    const {broker, deps} = setup();
    await expect(runCli(['buy', 'UNKNOWN', '1', '--broker', 'trading212'], deps)).rejects.toThrow('Cannot resolve');
    expect(broker.placeMarketOrder).not.toHaveBeenCalled();
  });

  it.each([[], ['--limit', '120']])('previews an order without submitting it: %j', async (...flags) => {
    const {broker, run} = setup();
    const result = await run(['buy', 'AAPL', '2', '--dry-run', ...flags]);
    expect(result).toMatchObject({json: {dryRun: true}});
    expect(broker.estimateFee).toHaveBeenCalledWith(
      PAIR,
      flags.length ? OrderType.LIMIT : OrderType.MARKET,
      expect.any(Big)
    );
    expect(broker.placeMarketOrder).not.toHaveBeenCalled();
    expect(broker.placeLimitOrder).not.toHaveBeenCalled();
  });

  it.each(['0.01', '101', '1.25'])('rejects a preview that violates quantity rules: %s', async size => {
    const {broker, run} = setup();
    await expect(run(['buy', 'AAPL', size, '--dry-run', '--limit', '100'])).rejects.toThrow('Quantity');
    expect(broker.placeLimitOrder).not.toHaveBeenCalled();
    expect(broker.estimateFee).not.toHaveBeenCalled();
  });

  it('quotes the most recent candle close and passes candle parameters through', async () => {
    const {broker, run} = setup();
    expect(await run(['quote', 'AAPL'])).toEqual({
      json: {base: 'AAPL', counter: 'USD', price: '100', time: CANDLE.openTimeInISO},
    });
    expect(await run(['candles', 'AAPL', '--count', '3', '--interval', '5m'])).toEqual({json: [CANDLE]});
    expect(broker.getRecentCandles).toHaveBeenCalledWith(PAIR, 3, 300_000);
  });

  it('lists rules, orders, fills, and broker time', async () => {
    const {broker, run} = setup();
    await run(['rules', 'AAPL']);
    expect(broker.getTradingRules).toHaveBeenCalledWith(PAIR);
    expect(await run(['orders', 'AAPL'])).toEqual({json: []});
    expect(await run(['fills', 'AAPL'])).toEqual({json: [FILL]});
    expect(await run(['time'])).toEqual({json: {time: CANDLE.openTimeInISO}});
  });

  it('cancels one order or every order for the selected pair', async () => {
    const {broker, run} = setup();
    expect(await run(['cancel', 'AAPL', '42'])).toEqual({json: {cancelled: ['42']}});
    expect(broker.cancelOrderById).toHaveBeenCalledWith(PAIR, '42');
    expect(await run(['cancel', 'AAPL', '--all'])).toEqual({json: {cancelled: ['42', '43']}});
    expect(broker.cancelOpenOrders).toHaveBeenCalledWith(PAIR);
  });

  it('returns a fill and reconciles an order that fills between requests', async () => {
    const {broker, run} = setup();
    broker.getFillByOrderId.mockResolvedValueOnce(undefined).mockResolvedValue(FILL);
    expect(await run(['wait', 'AAPL', '42'])).toEqual({json: {fill: FILL, status: 'FILLED'}});
    expect(broker.getFillByOrderId).toHaveBeenCalledTimes(2);
  });

  it('reports a closed order without a fill', async () => {
    const {run} = setup();
    await expect(run(['wait', 'AAPL', '42'])).rejects.toThrow('cancelled or rejected');
  });

  it('times out without cancelling the order', async () => {
    const {broker, run} = setup();
    broker.getOpenOrders.mockResolvedValue([
      {id: '42', pair: PAIR, price: '100', side: OrderSide.BUY, size: '1', type: 'LIMIT'},
    ]);
    await expect(run(['wait', 'AAPL', '42', '--timeout', '1ms'])).rejects.toThrow('does not cancel');
    expect(broker.cancelOrderById).not.toHaveBeenCalled();
    expect(broker.cancelOpenOrders).not.toHaveBeenCalled();
  });

  it.each(['watch-orders', 'watch-candles'])('streams exactly --take events and cleans up: %s', async command => {
    const {broker, deps, run} = setup();
    const candles = command === 'watch-candles';
    const subscribe = candles ? broker.watchCandles : broker.watchOrders;
    subscribe.mockImplementation(async () => {
      setTimeout(() => [1, 2, 3].forEach(value => broker.emit('topic', {value})), 0);
      return 'topic';
    });
    expect(await run([command, ...(candles ? ['AAPL'] : []), '--take', '2'])).toEqual({json: {events: 2}});
    expect(deps.writeEvent.mock.calls).toEqual([['{"value":1}'], ['{"value":2}']]);
    expect(candles ? broker.unwatchCandles : broker.unwatchOrders).toHaveBeenCalledWith('topic');
    expect(broker.listenerCount('topic')).toBe(0);
    expect(broker.listenerCount('error')).toBe(0);
    expect(broker.disconnect).toHaveBeenCalledOnce();
  });

  it('unsubscribes and disconnects when a stream fails', async () => {
    const {broker, run} = setup();
    broker.watchOrders.mockImplementation(async () => {
      setTimeout(() => broker.emit('error', new Error('stream failed')), 0);
      return 'topic';
    });
    await expect(run(['watch-orders'])).rejects.toThrow('stream failed');
    expect(broker.unwatchOrders).toHaveBeenCalledWith('topic');
    expect(broker.listenerCount('error')).toBe(0);
    expect(broker.disconnect).toHaveBeenCalledOnce();
  });

  it('preserves broker errors and disconnects after a failed command', async () => {
    const {broker, run} = setup();
    broker.listBalances.mockRejectedValue(new Error('/api-errors/example'));
    await expect(run(['balances'])).rejects.toThrow('/api-errors/example');
    expect(broker.disconnect).toHaveBeenCalledOnce();
  });

  it('supports Trading212 account composition without Alpaca credentials', async () => {
    const {broker} = createCliBroker('trading212', false, {
      TRADING212_PAPER_API_KEY: 'test-key',
      TRADING212_PAPER_API_SECRET: 'test-secret',
    });
    await expect(broker.getLatestCandle(PAIR, 60_000)).rejects.toThrow('Use --broker alpaca');
    broker.disconnect();
  });
});

describe('exchange-cli executable', () => {
  it.each([
    {args: ['--help'], code: 0, output: 'Usage:'},
    {args: ['balances', '--broker', 'alpaca'], code: 1, output: 'ALPACA_PAPER_API_KEY'},
    {args: ['buy', 'AAPL', '0', '--broker', 'alpaca'], code: 1, output: 'Invalid quantity'},
  ])('flushes the correct output stream and exits: $args', ({args, code, output}) => {
    const result = spawnSync(process.execPath, ['--import', 'tsx', `${import.meta.dirname}/exchange-cli.ts`, ...args], {
      encoding: 'utf8',
      env: {PATH: process.env.PATH},
      timeout: 10_000,
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(code);
    expect(code === 0 ? result.stdout : result.stderr).toContain(output);
    expect(code === 0 ? result.stderr : result.stdout).toBe('');
  });
});
