import {EventEmitter} from 'node:events';
import {execFile, type ExecFileException} from 'node:child_process';
import Big from 'big.js';
import {describe, expect, it, vi} from 'vitest';
import {
  OrderPosition,
  OrderSide,
  OrderType,
  TradingPair,
  type Broker,
  type Candle,
  type Fill,
  type CandleFeed,
  type MarketDataSource,
} from '@typedtrader/exchange';
import {AlpacaAPI, Trading212API} from '@typedtrader/exchange';
import {createCliBroker, readCredentials} from './cliBroker.js';
import {runCli, type CliDeps} from './runCli.js';

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
const ONE_DAY_IN_MS = 86_400_000;
/** A real calendar day, so a card asked for a date lands on a bar instead of on the epoch. */
const DAY_ZERO = Date.parse('2026-01-01T00:00:00Z');

/** Enough day-aligned candles for the chart health card to warm up and judge. */
function dailySeries(base: string, close: (index: number) => number, length = 240): Candle[] {
  return Array.from({length}, (_, index) => ({
    base,
    close: String(close(index)),
    counter: 'USD',
    high: String(close(index) + 1),
    low: String(close(index) - 1),
    open: String(close(Math.max(0, index - 1))),
    openTimeInISO: new Date(DAY_ZERO + index * ONE_DAY_IN_MS).toISOString(),
    openTimeInMillis: DAY_ZERO + index * ONE_DAY_IN_MS,
    sizeInMillis: ONE_DAY_IN_MS,
    volume: '1000',
  }));
}

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
    /*
     * The time window a dated card walks back through, served off the same series as the probe
     * above so that a cutoff lands on the bar of that day.
     */
    getCandles: vi
      .fn<CandleFeed['getCandles']>()
      .mockImplementation(async (pair, request) =>
        dailySeries(pair.base, index => 100 + index, 400).filter(
          candle =>
            candle.openTimeInMillis >= Date.parse(request.startTimeFirstCandle) &&
            candle.openTimeInMillis <= Date.parse(request.startTimeLastCandle)
        )
      ),
    getFeeRates: vi.fn<Broker['getFeeRates']>().mockResolvedValue({LIMIT: new Big(0), MARKET: new Big(0)}),
    getFillByOrderId: vi.fn<Broker['getFillByOrderId']>().mockResolvedValue(undefined),
    getFills: vi.fn<Broker['getFills']>().mockResolvedValue([FILL]),
    getLatestCandle: vi.fn<MarketDataSource['getLatestCandle']>().mockResolvedValue(CANDLE),
    getOpenOrders: vi.fn<Broker['getOpenOrders']>().mockResolvedValue([]),
    /*
     * Enough history for the average range behind a protective stop, since that is what a buy
     * fetches. A test that cares about the candles themselves narrows this to its own series.
     */
    getRecentCandles: vi
      .fn<MarketDataSource['getRecentCandles']>()
      .mockImplementation(async pair => dailySeries(pair.base, index => 100 + index, 60)),
    getSmallestInterval: vi.fn<Broker['getSmallestInterval']>().mockReturnValue(60_000),
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
    placeLimitOrder: vi.fn<Broker['placeLimitOrder']>().mockResolvedValue({
      id: '42',
      pair: PAIR,
      price: '100',
      side: OrderSide.BUY,
      size: '1',
      type: OrderType.LIMIT,
    }),
    placeMarketOrder: vi.fn<Broker['placeMarketOrder']>().mockResolvedValue({
      id: '42',
      pair: PAIR,
      side: OrderSide.BUY,
      size: '1',
      sizeInCounter: false,
      type: OrderType.MARKET,
    }),
    placeStopOrder: vi.fn<Broker['placeStopOrder']>().mockImplementation(async (pair, {side, size, stopPrice}) => ({
      id: '99',
      pair,
      side,
      size,
      stopPrice,
      type: 'STOP',
    })),
    supportsStopOrders: true,
    unwatchCandles: vi.fn(),
    unwatchOrders: vi.fn(),
    verifyCredentials: vi.fn<Broker['verifyCredentials']>().mockResolvedValue(undefined),
    watchCandles: vi.fn<MarketDataSource['watchCandles']>().mockResolvedValue('candles'),
    watchOrders: vi.fn<Broker['watchOrders']>().mockResolvedValue('orders'),
  });
  const listInstruments = vi.fn<ReturnType<typeof createCliBroker>['listInstruments']>().mockResolvedValue(INSTRUMENTS);
  const deps = {
    createBroker: vi.fn<CliDeps['createBroker']>().mockReturnValue({
      broker: broker as unknown as Broker & CandleFeed,
      listInstruments,
    }),
    env: {},
    writeEvent: vi.fn<CliDeps['writeEvent']>(),
  };
  const run = (args: string[]) => runCli([...args, '--broker', 'alpaca'], deps);
  return {broker, deps, listInstruments, run};
}

/*
 * Vitest clears all mocks before each test. Running these concurrently would let one test's clear
 * wipe the call history another test is about to assert on.
 */
describe('runCli', {concurrent: false}, () => {
  it.each([[], ['help'], ['--help']])('shows help without constructing a broker: %j', async (...args) => {
    const {deps} = setup();
    const result = await runCli(args, deps);
    expect(result).toHaveProperty('text');
    if ('text' in result) {
      expect(result.text).toContain('Usage: exchange-cli');
    }
    expect(deps.createBroker).not.toHaveBeenCalled();
  });

  it.each([
    ['buy', '--help'],
    ['help', 'buy'],
  ])('generates command-specific help without constructing a broker: %j', async (...args) => {
    const {deps} = setup();
    const result = await runCli(args, deps);
    expect(result).toHaveProperty('text');
    if ('text' in result) {
      expect(result.text).toContain('exchange-cli buy [options] <ticker> <quantity>');
      expect(result.text).toContain('--limit');
      expect(result.text).toContain('--dry-run');
      expect(result.text).toContain('--broker');
      expect(result.text).not.toContain('--take');
    }
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
    ['buy', ' ', '1'],
    ['buy', 'AAPL', '1', '--limit', '0'],
    ['buy', 'AAPL', '1', '--limit', ''],
    ['buy', 'AAPL', '1', '--all'],
    ['buy', 'AAPL', '1', '--count', '2'],
    ['cancel', 'AAPL'],
    ['cancel', 'AAPL', '42', '--dry-run'],
    ['cancel', 'AAPL', '42', '--all'],
    ['candles', 'AAPL', '--count', '0'],
    ['wait', 'AAPL', '42', '--poll', ''],
    ['watch-orders', '--take', '1.5'],
    ['watch-orders', '--take', ''],
  ])('rejects invalid input before constructing a broker: %j', async (...args) => {
    const {deps, run} = setup();
    await expect(run(args)).rejects.toThrow();
    expect(deps.createBroker).not.toHaveBeenCalled();
  });

  it.each(
    [
      {args: ['candles', 'AAPL'], flag: '--interval'},
      {args: ['watch-candles', 'AAPL'], flag: '--interval'},
      {args: ['wait', 'AAPL', '42'], flag: '--timeout'},
      {args: ['wait', 'AAPL', '42'], flag: '--poll'},
    ].flatMap(({args, flag}) => ['nonsense', '0m', '-1m'].map(value => ({args, flag, value})))
  )('rejects $flag=$value before constructing a broker: $args', async ({args, flag, value}) => {
    const {deps, run} = setup();
    deps.createBroker.mockImplementation(() => {
      throw new Error('Unexpected broker construction');
    });
    await expect(run([...args, flag, value])).rejects.toThrow(flag);
    expect(deps.createBroker, 'invalid durations must not start broker connections or polling').not.toHaveBeenCalled();
  });

  it.each(['', '   '])('rejects a blank --counter before constructing a broker: %j', async counter => {
    const {deps, run} = setup();
    deps.createBroker.mockImplementation(() => {
      throw new Error('Unexpected broker construction');
    });
    await expect(run(['buy', 'AAPL', '1', '--counter', counter])).rejects.toThrow('--counter');
    expect(deps.createBroker).not.toHaveBeenCalled();
  });

  it.each(['', '   '])('rejects a blank --benchmark before constructing a broker: %j', async benchmark => {
    const {deps, run} = setup();
    await expect(run(['health', 'AAPL', '--benchmark', benchmark])).rejects.toThrow('--benchmark');
    expect(deps.createBroker).not.toHaveBeenCalled();
  });

  it('requires an explicit supported broker', async () => {
    await expect(runCli(['balances'])).rejects.toThrow('--broker');
    await expect(runCli(['balances', '--broker', 'binance'])).rejects.toThrow('--broker');
  });

  it('accepts ibkr as a broker name', async () => {
    const {broker, deps} = setup();
    await runCli(['--broker', 'IBKR', '--live', 'balances'], deps);
    expect(deps.createBroker).toHaveBeenCalledWith('ibkr', true, deps.env);
    expect(broker.listBalances).toHaveBeenCalledOnce();
  });

  it('defaults to paper even if an environment flag requests live', async () => {
    const {deps, run} = setup();
    deps.env = {ALPACA_USE_PAPER: 'false'};
    await run(['balances']);
    expect(deps.createBroker).toHaveBeenCalledWith('alpaca', false, deps.env);
    await run(['balances', '--live']);
    expect(deps.createBroker).toHaveBeenLastCalledWith('alpaca', true, deps.env);
  });

  it('accepts global options before a command and normalizes the broker name', async () => {
    const {broker, deps} = setup();
    await runCli(['--broker', 'ALPACA', '--live', 'balances'], deps);
    expect(deps.createBroker).toHaveBeenCalledWith('alpaca', true, deps.env);
    expect(broker.listBalances).toHaveBeenCalledOnce();
  });

  it('selects only the requested environment credentials', () => {
    const env = {ALPACA_LIVE_API_KEY: 'live-key', ALPACA_LIVE_API_SECRET: 'live-secret'};
    expect(() => createCliBroker('alpaca', false, env)).toThrow('ALPACA_PAPER_API_KEY');
    expect(() => createCliBroker('trading212', true, {})).toThrow('TRADING212_LIVE_API_KEY');
  });

  it('reads IBKR credentials without the PAPER/LIVE prefix, and tolerates their absence', () => {
    expect(
      () => createCliBroker('ibkr', true, {IBKR_PASSWORD: 'secret', IBKR_USERNAME: 'user'}),
      'IBKR takes the Pro username and password, not an API key pair'
    ).not.toThrow();
    expect(
      () => createCliBroker('ibkr', true, {}),
      'an empty pair still addresses a gateway somebody logged in already'
    ).not.toThrow();
  });

  it('builds an IBKR broker for paper trading, which is a separate login rather than an endpoint', () => {
    expect(() =>
      createCliBroker('ibkr', false, {IBKR_PAPER_PASSWORD: 'secret', IBKR_PAPER_USERNAME: 'paper-user'})
    ).not.toThrow();
  });

  it.each([
    {
      env: {IBKR_PAPER_PASSWORD: 'paper-secret', IBKR_PAPER_USERNAME: 'paper-user'},
      expected: 'paper-user',
      live: false,
    },
    {env: {IBKR_LIVE_PASSWORD: 'live-secret', IBKR_LIVE_USERNAME: 'live-user'}, expected: 'live-user', live: true},
    {env: {IBKR_PASSWORD: 'either-secret', IBKR_USERNAME: 'either-user'}, expected: 'either-user', live: false},
  ])('reads the IBKR credentials for the environment asked for: $expected', ({env, expected, live}) => {
    expect(
      readCredentials('ibkr', live, env).apiKey,
      'the paper account has its own username, so the live pair would log the gateway into the wrong environment'
    ).toBe(expected);
  });

  it('takes the IBKR pair whole rather than completing it from the unprefixed names', () => {
    const credentials = readCredentials('ibkr', false, {
      IBKR_PAPER_USERNAME: 'paper-user',
      IBKR_PASSWORD: 'live-secret',
      IBKR_USERNAME: 'live-user',
    });

    expect(
      credentials.apiSecret,
      'IBKR gives paper and live different passwords, so borrowing the live one builds a pair belonging to neither login'
    ).toBe('');
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

  it('protects a filled buy with a stop below the price it paid', async () => {
    const {broker, run} = setup();
    broker.getFillByOrderId.mockResolvedValue({...FILL, price: '500', size: '2'});

    const result = await run(['buy', 'AAPL', '2', '--stop-atr', '3']);

    expect(broker.placeStopOrder).toHaveBeenCalledWith(PAIR, {side: OrderSide.SELL, size: '2', stopPrice: '494'});
    expect(result).toMatchObject({
      json: {
        stop: {anchor: 'fill', anchorPrice: '500', atr: '2', atrMultiple: '3', orderId: '99', stopPrice: '494'},
      },
    });
  });

  it.each([
    {expected: '496', multiple: '2'},
    {expected: '494', multiple: '3'},
  ])('places the stop $multiple average ranges below the fill', async ({expected, multiple}) => {
    const {broker, run} = setup();
    broker.getFillByOrderId.mockResolvedValue({...FILL, price: '500', size: '1'});

    await run(['buy', 'AAPL', '1', '--stop-atr', multiple]);

    expect(broker.placeStopOrder).toHaveBeenCalledWith(PAIR, {side: OrderSide.SELL, size: '1', stopPrice: expected});
  });

  it('refuses to buy what it cannot protect', async () => {
    const {broker, deps} = setup();
    broker.supportsStopOrders = false;

    await expect(runCli(['buy', 'RRl_EQ', '1', '--stop-atr', '3', '--broker', 'trading212'], deps)).rejects.toThrow(
      'cannot place a protective stop'
    );
    expect(broker.placeMarketOrder, 'the position that must not exist is the one with no stop').not.toHaveBeenCalled();
  });

  it('places no stop unless one is asked for', async () => {
    const {broker, run} = setup();

    await run(['buy', 'AAPL', '1']);
    await run(['sell', 'AAPL', '1']);

    expect(broker.placeStopOrder).not.toHaveBeenCalled();
  });

  it('shows the stop a dry run would place without placing anything', async () => {
    const {broker, run} = setup();

    const result = await run(['buy', 'AAPL', '2', '--dry-run', '--stop-atr', '3']);

    expect(result).toMatchObject({json: {dryRun: true, plannedStop: {atrMultiple: '3', room: 'balanced'}}});
    expect(broker.placeStopOrder).not.toHaveBeenCalled();
    expect(broker.placeMarketOrder).not.toHaveBeenCalled();
  });

  it('rejects unknown Trading212 symbols before submission', async () => {
    const {broker, deps} = setup();
    await expect(runCli(['buy', 'UNKNOWN', '1', '--broker', 'trading212'], deps)).rejects.toThrow('Cannot resolve');
    expect(broker.placeMarketOrder).not.toHaveBeenCalled();
  });

  it.each([
    {flags: [], notional: '200', type: OrderType.MARKET},
    {flags: ['--limit', '120'], notional: '240', type: OrderType.LIMIT},
  ])('previews a $type order without submitting it', async ({flags, notional, type}) => {
    const {broker, run} = setup();
    broker.getRecentCandles.mockImplementation(async pair => dailySeries(pair.base, index => 100 + index, 60));

    const result = await run(['buy', 'AAPL', '2', '--dry-run', ...flags]);
    expect(result).toMatchObject({json: {dryRun: true, estimatedNotional: new Big(notional)}});
    expect(broker.estimateFee).toHaveBeenCalledWith(PAIR, type, new Big(notional));
    expect(broker.placeMarketOrder).not.toHaveBeenCalled();
    expect(broker.placeLimitOrder).not.toHaveBeenCalled();
  });

  it.each(['0.01', '101', '1.25'])('rejects a preview that violates quantity rules: %s', async size => {
    const {broker, run} = setup();
    await expect(run(['buy', 'AAPL', size, '--dry-run', '--limit', '100'])).rejects.toThrow('Quantity');
    expect(broker.placeLimitOrder).not.toHaveBeenCalled();
    expect(broker.estimateFee).not.toHaveBeenCalled();
  });

  it('rejects a limit preview with a price between permitted increments', async () => {
    const {broker, run} = setup();
    await expect(run(['buy', 'AAPL', '1', '--dry-run', '--limit', '100.001'])).rejects.toThrow(
      'Limit price must be a multiple of 0.01'
    );
    expect(broker.estimateFee).not.toHaveBeenCalled();
    expect(broker.placeLimitOrder).not.toHaveBeenCalled();
  });

  it.each([[], ['--limit', '0.99']])('rejects a preview below the minimum order value: %j', async (...flags) => {
    const {broker, run} = setup();
    broker.getLatestCandle.mockResolvedValue({...CANDLE, close: '0.99'});
    await expect(run(['buy', 'AAPL', '1', '--dry-run', ...flags])).rejects.toThrow(
      'Order value must be at least 1 USD'
    );
    expect(broker.estimateFee).not.toHaveBeenCalled();
    expect(broker.placeMarketOrder).not.toHaveBeenCalled();
    expect(broker.placeLimitOrder).not.toHaveBeenCalled();
  });

  it('accepts a limit preview exactly at the minimum order value', async () => {
    const {broker, run} = setup();
    expect(await run(['buy', 'AAPL', '0.1', '--dry-run', '--limit', '10'])).toMatchObject({json: {dryRun: true}});
    expect(broker.estimateFee).toHaveBeenCalledWith(PAIR, OrderType.LIMIT, new Big(1));
  });

  it('does not apply the limit-price increment to a market-price estimate', async () => {
    const {broker, run} = setup();
    broker.getLatestCandle.mockResolvedValue({...CANDLE, close: '100.001'});
    expect(await run(['buy', 'AAPL', '1', '--dry-run'])).toMatchObject({json: {dryRun: true}});
    expect(broker.estimateFee).toHaveBeenCalledWith(PAIR, OrderType.MARKET, new Big('100.001'));
  });

  it('allows a limit price when no positive price increment is configured', async () => {
    const {broker, run} = setup();
    const rules = await broker.getTradingRules(PAIR);
    broker.getTradingRules.mockResolvedValue({...rules, counter_increment: '0'});
    broker.getRecentCandles.mockImplementation(async pair => dailySeries(pair.base, index => 100 + index, 60));

    expect(await run(['buy', 'AAPL', '1', '--dry-run', '--limit', '100.001'])).toMatchObject({json: {dryRun: true}});
  });

  it('runs every read-only call under smoke and places no orders', async () => {
    const {broker, run} = setup();

    const result = await run(['smoke', 'AAPL']);

    expect(result).toMatchObject({code: 0, json: {ok: true, pair: 'AAPL/USD'}});
    expect(
      broker.placeMarketOrder,
      'this is pointed at live accounts to see what a broker answers, so it must not trade'
    ).not.toHaveBeenCalled();
    expect(broker.placeLimitOrder).not.toHaveBeenCalled();
    expect(broker.cancelOpenOrders).not.toHaveBeenCalled();
    expect(broker.verifyCredentials).toHaveBeenCalled();
    expect(broker.getFills).toHaveBeenCalled();
  });

  it('reports a failing call and still runs the rest, with a non-zero exit code', async () => {
    const {broker, run} = setup();
    broker.getTradingRules.mockRejectedValue(new Error('No market data subscription'));

    const result = await run(['smoke', 'AAPL', '--interval', '1h']);

    const reportedError: unknown = expect.stringContaining('No market data subscription');
    const expectedChecks: unknown = expect.arrayContaining([
      expect.objectContaining({check: 'getTradingRules', error: reportedError, ok: false}),
      expect.objectContaining({check: 'getFills', ok: true}),
    ]);

    expect(
      result,
      'an unentitled endpoint is one broken call, not a broken broker, so the others still have to be reported'
    ).toMatchObject({code: 1, json: {checks: expectedChecks, ok: false}});
    expect(broker.getRecentCandles).toHaveBeenCalledWith(PAIR, 3, 3_600_000);
  });

  it('quotes the most recent candle close and passes candle parameters through', async () => {
    const {broker, run} = setup();
    expect(await run(['quote', 'AAPL'])).toEqual({
      json: {base: 'AAPL', counter: 'USD', price: '100', time: CANDLE.openTimeInISO},
    });
    broker.getRecentCandles.mockResolvedValue([CANDLE]);
    expect(await run(['candles', 'AAPL', '--count', '3', '--interval', '5m'])).toEqual({json: [CANDLE]});
    expect(broker.getRecentCandles).toHaveBeenCalledWith(PAIR, 3, 300_000);
  });

  it.each([
    {command: 'candles', interval: '90m', millis: 5_400_000},
    {command: 'watch-candles', interval: '1 hour', millis: 3_600_000},
  ])('passes parsed durations to $command: $interval', async ({command, interval, millis}) => {
    const {broker, run} = setup();
    if (command === 'candles') {
      await run([command, 'AAPL', '--interval', interval]);
      expect(broker.getRecentCandles).toHaveBeenCalledWith(PAIR, 10, millis);
    } else {
      broker.watchCandles.mockImplementation(async () => {
        setTimeout(() => broker.emit('topic', CANDLE), 0);
        return 'topic';
      });
      await run([command, 'AAPL', '--interval', interval, '--take', '1']);
      expect(broker.watchCandles).toHaveBeenCalledWith(PAIR, millis, expect.any(String));
    }
  });

  it('scores chart health on daily bars', async () => {
    const {broker, run} = setup();
    broker.getRecentCandles.mockImplementation(async pair => dailySeries(pair.base, index => 100 + index));

    const result = await run(['health', 'AAPL']);

    expect(broker.getRecentCandles).toHaveBeenCalledWith(PAIR, 120, 86_400_000);
    expect(result).toHaveProperty('json');
    if ('json' in result) {
      expect(result.json).toMatchObject({health: 100, timeframe: '1d', verdict: 'noise'});
    }
  });

  it('reads the card as of a given day, counting every period back from there', async () => {
    const {broker, run} = setup();

    const result = await run(['health', 'AAPL', '--date', '2026-09-01']);

    expect(broker.getRecentCandles, 'a dated card reads a window, not the newest bars').not.toHaveBeenCalled();
    expect(result).toHaveProperty('json');
    if ('json' in result) {
      expect(result.json, 'the last bar on the card is the session that was asked for').toMatchObject({
        asOf: '2026-09-01T00:00:00.000Z',
      });
    }
  });

  it('withholds the session still forming from a card dated today', async () => {
    const {run} = setup();
    vi.useFakeTimers({now: Date.parse('2026-09-01T12:00:00Z'), toFake: ['Date']});

    try {
      const result = await run(['health', 'AAPL', '--date', '2026-09-01']);

      expect(result).toHaveProperty('json');
      if ('json' in result) {
        expect(
          result.json,
          'the bar of the requested day has not closed yet, so the card ends on the one before it'
        ).toMatchObject({asOf: '2026-08-31T00:00:00.000Z'});
      }
    } finally {
      vi.useRealTimers();
    }
  });

  // `2026-02-31` is the case a shape test passes: it is the right shape and is not a day.
  it.each(['2026-13-40', '2026-02-31', '2026-1-2', 'yesterday'])(
    'rejects %j, which is not a calendar day',
    async date => {
      const {deps} = setup();
      await expect(runCli(['--broker', 'alpaca', 'health', 'AAPL', '--date', date], deps)).rejects.toThrow(
        'calendar day'
      );
      expect(deps.createBroker).not.toHaveBeenCalled();
    }
  );

  it('leaves relative strength unread until a benchmark is named', async () => {
    const {broker, run} = setup();
    /*
     * The instrument creeps up in a zigzag rather than a straight line, so that every other check
     * has both up and down bars to read and relative strength is the only unanswered one.
     */
    broker.getRecentCandles.mockImplementation(async pair =>
      dailySeries(pair.base, index =>
        pair.base === 'SPY' ? 400 + index * 2 : 100 + index * 0.2 + (index % 2 === 0 ? 0 : 0.5)
      )
    );

    const alone = await run(['health', 'AAPL']);
    const compared = await run(['health', 'AAPL', '--benchmark', 'SPY']);

    expect(broker.getRecentCandles).toHaveBeenCalledWith(new TradingPair('SPY', 'USD'), 120, 86_400_000);
    if ('json' in alone && 'json' in compared) {
      expect(alone.json, 'the check that needs a second series has nothing to read').toMatchObject({
        health: 90,
        unreadWeight: 15,
      });
      expect(
        compared.json,
        'a stock creeping up while its index runs is losing ground, which costs it the full 15 points'
      ).toMatchObject({health: 75, unreadWeight: 0});
    }
  });

  it('lays the card out for a reader with --table', async () => {
    const {broker, run} = setup();
    broker.getRecentCandles.mockImplementation(async pair => dailySeries(pair.base, index => 400 - index));

    const result = await run(['health', 'AAPL', '--table']);

    expect(result).toHaveProperty('text');
    if ('text' in result) {
      expect(result.text).toContain('AAPL  ');
      expect(result.text, 'the questions carry the card, not the check names').toContain(
        'Is price making lower highs and lower lows?'
      );
      expect(result.text, 'a check that fired shows what it cost').toContain('-23');
      expect(result.text, 'the columns are labelled, so a reader need not guess which number is which').toMatch(
        /CRIT\s+CHECK\s+DESCRIPTION\s+VALUE\s+THRESHOLD\s+DIVERGENCE/
      );
      expect(result.text, 'each reading names the indicator it came off').toMatch(/SMA 50 +close vs average/);
      expect(result.text, 'a score with no date cannot be compared with the next one').toContain('as of');
    }
  });

  it('names the warm-up it needs when too little history arrives', async () => {
    const {broker, run} = setup();
    broker.getRecentCandles.mockResolvedValue([CANDLE]);

    await expect(run(['health', 'AAPL'])).rejects.toThrow(/at least 69 daily candles, but 1 arrived/);
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
    expect(await run([command, ...(candles ? ['AAPL', '--interval', '2h'] : []), '--take', '2'])).toEqual({
      json: {events: 2},
    });
    if (candles) {
      expect(broker.watchCandles).toHaveBeenCalledWith(PAIR, 7_200_000, expect.any(String));
    }
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

  it('reports what each broker knows about an instrument', async () => {
    vi.spyOn(AlpacaAPI.prototype, 'getAssets').mockResolvedValue([
      {
        class: 'us_equity',
        easy_to_borrow: true,
        exchange: 'ARCA',
        fractionable: true,
        id: 'a',
        marginable: true,
        name: 'iShares MSCI World ETF',
        shortable: true,
        status: 'active',
        symbol: 'URTH',
        tradable: true,
      },
    ]);
    const alpaca = createCliBroker('alpaca', false, {
      ALPACA_PAPER_API_KEY: 'test-key',
      ALPACA_PAPER_API_SECRET: 'test-secret',
    });
    await expect(alpaca.listInstruments()).resolves.toEqual([
      {
        currency: 'USD',
        exchange: 'ARCA',
        fractionable: true,
        name: 'iShares MSCI World ETF',
        ticker: 'URTH',
        tradable: true,
      },
    ]);
    alpaca.broker.disconnect();

    vi.spyOn(Trading212API.prototype, 'getExchanges').mockResolvedValue([
      {id: 1, name: 'London Stock Exchange', workingSchedules: [{id: 55}]},
    ]);
    vi.spyOn(Trading212API.prototype, 'getInstruments').mockResolvedValue([
      {
        addedOn: '2018-07-12T07:10:10.000+03:00',
        currencyCode: 'GBX',
        isin: 'GB00B63H8491',
        name: 'Rolls-Royce',
        ticker: 'RRl_EQ',
        type: 'STOCK',
        workingScheduleId: 55,
      },
    ]);
    const trading212 = createCliBroker('trading212', false, {
      TRADING212_PAPER_API_KEY: 'test-key',
      TRADING212_PAPER_API_SECRET: 'test-secret',
    });
    await expect(
      trading212.listInstruments(),
      'the venue comes from the working schedule, while tradability and fractions are absent because Trading212 publishes neither'
    ).resolves.toEqual([
      {
        currency: 'GBX',
        exchange: 'London Stock Exchange',
        isin: 'GB00B63H8491',
        name: 'Rolls-Royce',
        ticker: 'RRl_EQ',
      },
    ]);
    trading212.broker.disconnect();
  });

  it('supports Trading212 account composition without Alpaca credentials', async () => {
    const {broker} = createCliBroker('trading212', false, {
      TRADING212_PAPER_API_KEY: 'test-key',
      TRADING212_PAPER_API_SECRET: 'test-secret',
    });
    await expect(
      broker.getLatestCandle(PAIR, 60_000),
      'the borrowed feed is the only thing missing, so the failure names the variables that would supply it'
    ).rejects.toThrow('Set ALPACA_PAPER_API_KEY and ALPACA_PAPER_API_SECRET');
    broker.disconnect();
  });
});

/*
 * These spawn real Node processes. Run them sequentially without blocking the test worker;
 * cold tsx startup can be slow when CI runs all workspace tests at the same time.
 */
describe('exchange-cli executable', {concurrent: false, timeout: 15_000}, () => {
  it.each([
    {args: ['--help'], code: 0, output: 'Usage:'},
    {args: ['buy', '--help'], code: 0, output: '--limit'},
    {args: ['balances', '--broker', 'alpaca'], code: 1, output: 'ALPACA_PAPER_API_KEY'},
    {args: ['buy', 'AAPL', '0', '--broker', 'alpaca'], code: 1, output: 'positive decimal'},
  ])('flushes the correct output stream and exits: $args', async ({args, code, output}) => {
    const result = await new Promise<{error: ExecFileException | null; stdout: string; stderr: string}>(resolve => {
      execFile(
        process.execPath,
        ['--import', 'tsx', `${import.meta.dirname}/exchange-cli.ts`, ...args],
        {
          encoding: 'utf8',
          env: {PATH: process.env.PATH},
          timeout: 10_000,
        },
        (error, stdout, stderr) => resolve({error, stderr, stdout})
      );
    });
    if (code === 0) {
      expect(result.error).toBeNull();
    } else {
      expect(result.error).toMatchObject({code, killed: false, signal: null});
    }
    expect(code === 0 ? result.stdout : result.stderr).toContain(output);
    expect(code === 0 ? result.stderr : result.stdout).toBe('');
  });
});
