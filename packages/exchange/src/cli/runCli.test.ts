import {EventEmitter} from 'node:events';
import Big from 'big.js';
import {describe, expect, it, vi} from 'vitest';
import type {Broker, Candle, Fill} from '../broker/Broker.js';
import {OrderPosition, OrderSide} from '../broker/Broker.js';
import type {MarketDataSource} from '../broker/MarketDataSource.js';
import {TradingPair} from '../broker/TradingPair.js';
import type {CliDeps, InstrumentInfo} from './runCli.js';
import {runCli, USAGE} from './runCli.js';

const ENV = {
  ALPACA_API_KEY: 'alpaca-key',
  ALPACA_API_SECRET: 'alpaca-secret',
  TRADING212_API_KEY: 'trading212-key',
  TRADING212_API_SECRET: 'trading212-secret',
};

const INSTRUMENTS: InstrumentInfo[] = [
  {currency: 'GBX', isin: 'GB00B63H8491', name: 'Rolls-Royce', ticker: 'RRl_EQ', type: 'STOCK'},
  {currency: 'USD', isin: 'US0378331005', name: 'Apple', ticker: 'AAPL_US_EQ', type: 'STOCK'},
];

function createBrokerStub() {
  const stub = {
    cancelOpenOrders: vi.fn<Broker['cancelOpenOrders']>().mockResolvedValue(['1', '2']),
    cancelOrderById: vi.fn<Broker['cancelOrderById']>().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    estimateFee: vi.fn<Broker['estimateFee']>(),
    getFillByOrderId: vi.fn<Broker['getFillByOrderId']>(),
    getLatestCandle: vi.fn<MarketDataSource['getLatestCandle']>(),
    getOpenOrders: vi.fn<Broker['getOpenOrders']>(),
    getRecentCandles: vi.fn<MarketDataSource['getRecentCandles']>(),
    getSmallestInterval: vi.fn<Broker['getSmallestInterval']>().mockReturnValue(60_000),
    getTradingRules: vi.fn<Broker['getTradingRules']>(),
    listBalances: vi.fn<Broker['listBalances']>().mockResolvedValue([]),
    placeLimitOrder: vi.fn(),
    placeMarketOrder: vi.fn(),
    verifyCredentials: vi.fn<Broker['verifyCredentials']>().mockResolvedValue(undefined),
  };
  return stub;
}

function createDeps(brokerStub: ReturnType<typeof createBrokerStub>) {
  const releaseStreamLock = vi.fn();
  return {
    acquireStreamLock: vi.fn<CliDeps['acquireStreamLock']>().mockReturnValue(releaseStreamLock),
    env: ENV,
    getBroker: vi.fn<CliDeps['getBroker']>().mockReturnValue(brokerStub as unknown as Broker & MarketDataSource),
    listInstruments: vi.fn<CliDeps['listInstruments']>().mockResolvedValue(INSTRUMENTS),
    releaseStreamLock,
    writeEvent: vi.fn<CliDeps['writeEvent']>(),
  } satisfies CliDeps & {releaseStreamLock: ReturnType<typeof vi.fn>};
}

describe('runCli', () => {
  it('prints usage when no command is given', async () => {
    const result = await runCli([]);
    expect(result.text).toBe(USAGE);
  });

  it('requires an explicit broker', async () => {
    await expect(runCli(['balances'])).rejects.toThrow('Missing --broker');
  });

  it('rejects unknown brokers with the available choices', async () => {
    await expect(runCli(['balances', '--broker', 'binance'])).rejects.toThrow('alpaca, trading212');
  });

  it('names the exact env vars when credentials are missing', async () => {
    const broker = createBrokerStub();
    const deps = {...createDeps(broker), env: {}};
    await expect(runCli(['balances', '--broker', 'trading212'], deps)).rejects.toThrow('TRADING212_API_KEY');
  });

  it('targets the live account when --live is given', async () => {
    const broker = createBrokerStub();
    broker.placeMarketOrder.mockResolvedValue({id: '1'});
    const deps = createDeps(broker);

    await runCli(['buy', 'RRl_EQ', '1', '--broker', 'trading212', '--live', '--counter', 'GBX'], deps);

    expect(deps.getBroker).toHaveBeenCalledWith(
      {apiKey: 'trading212-key', apiSecret: 'trading212-secret', exchangeId: 'Trading212', isPaper: false},
      expect.anything()
    );
  });

  it('places a paper market order with the instrument-resolved counter currency', async () => {
    const broker = createBrokerStub();
    broker.placeMarketOrder.mockResolvedValue({id: '1'});
    const deps = createDeps(broker);

    await runCli(['buy', 'RRl_EQ', '1', '--broker', 'trading212'], deps);

    expect(broker.placeMarketOrder).toHaveBeenCalledWith(expect.objectContaining({base: 'RRl_EQ', counter: 'GBX'}), {
      side: OrderSide.BUY,
      size: '1',
      sizeInCounter: false,
    });
  });

  it('places a limit order when --limit is given and skips the lookup when --counter is given', async () => {
    const broker = createBrokerStub();
    broker.placeLimitOrder.mockResolvedValue({id: '1'});
    const deps = createDeps(broker);

    await runCli(['sell', 'RRl_EQ', '1', '--broker', 'trading212', '--limit', '1500', '--counter', 'GBX'], deps);

    expect(broker.placeLimitOrder).toHaveBeenCalledWith(expect.objectContaining({counter: 'GBX'}), {
      price: '1500',
      side: OrderSide.SELL,
      size: '1',
    });
    expect(deps.listInstruments, '--counter must bypass the instruments fetch').not.toHaveBeenCalled();
  });

  it('rejects tickers unknown to the broker with a pointer to the instruments command', async () => {
    const broker = createBrokerStub();
    const deps = createDeps(broker);
    await expect(runCli(['buy', 'TYPO_EQ', '1', '--broker', 'trading212'], deps)).rejects.toThrow(
      'instruments <query>'
    );
  });

  it('filters instruments case-insensitively across ticker, name, and ISIN', async () => {
    const broker = createBrokerStub();
    const deps = createDeps(broker);

    const result = await runCli(['instruments', 'rolls', '--broker', 'trading212'], deps);

    expect(result.json).toEqual([INSTRUMENTS[0]]);
  });

  it('cancels all open orders for a ticker with --all', async () => {
    const broker = createBrokerStub();
    const deps = createDeps(broker);

    const result = await runCli(['cancel', 'RRl_EQ', '--all', '--broker', 'trading212'], deps);

    expect(result.json).toEqual({cancelled: ['1', '2']});
  });

  const RR_PAIR = new TradingPair('RRl_EQ', 'GBX');

  const CANDLE: Candle = {
    base: 'RRl_EQ',
    close: '1492.7',
    counter: 'GBX',
    high: '1495',
    low: '1490',
    open: '1494',
    openTimeInISO: '2026-08-21T10:00:00.000Z',
    openTimeInMillis: 1787306400000,
    sizeInMillis: 60000,
    volume: '100',
  };

  const FILL: Fill = {
    created_at: '2026-08-21T10:00:00.000Z',
    fee: '0',
    feeAsset: 'EUR',
    order_id: '42',
    pair: RR_PAIR,
    position: OrderPosition.LONG,
    price: '1492.7',
    side: OrderSide.BUY,
    size: '1',
  };

  it('quotes the close of the latest smallest-interval candle', async () => {
    const broker = createBrokerStub();
    broker.getLatestCandle.mockResolvedValue(CANDLE);
    const deps = createDeps(broker);

    const result = await runCli(['quote', 'RRl_EQ', '--broker', 'trading212', '--counter', 'GBX'], deps);

    expect(result.json).toEqual({
      base: 'RRl_EQ',
      counter: 'GBX',
      price: '1492.7',
      time: '2026-08-21T10:00:00.000Z',
    });
  });

  it('computes an indicator over recent candles', async () => {
    const broker = createBrokerStub();
    const closes = ['10', '20', '30'];
    broker.getRecentCandles.mockResolvedValue(closes.map(close => ({...CANDLE, close})));
    const deps = createDeps(broker);

    const result = await runCli(
      ['indicator', 'sma', 'RRl_EQ', '--broker', 'trading212', '--counter', 'GBX', '--period', '2', '--count', '3'],
      deps
    );

    expect(result.json).toMatchObject({indicator: 'sma', lastClose: 30, period: 2, value: 25});
  });

  it('reports the ATR additionally as a percent of the last close', async () => {
    const broker = createBrokerStub();
    // Constant 10-point range on every candle at close 100 → ATR 10 → 10%
    const candles = Array.from({length: 10}, () => ({...CANDLE, close: '100', high: '105', low: '95'}));
    broker.getRecentCandles.mockResolvedValue(candles);
    const deps = createDeps(broker);

    const result = await runCli(
      ['indicator', 'atr', 'RRl_EQ', '--broker', 'trading212', '--counter', 'GBX', '--period', '3', '--count', '10'],
      deps
    );

    expect(result.json).toMatchObject({indicator: 'atr', value: 10, valuePct: 10});
  });

  it('rejects unknown indicators and lists the available ones', async () => {
    const broker = createBrokerStub();
    const deps = createDeps(broker);
    await expect(
      runCli(['indicator', 'macd', 'RRl_EQ', '--broker', 'trading212', '--counter', 'GBX'], deps)
    ).rejects.toThrow('atr, ema, rsi, sma');
  });

  it('waits until the order fills and returns the fill', async () => {
    const broker = createBrokerStub();
    broker.getFillByOrderId.mockResolvedValue(FILL);
    const deps = createDeps(broker);

    const result = await runCli(['wait', 'RRl_EQ', '42', '--broker', 'trading212', '--counter', 'GBX'], deps);

    expect(result.json).toEqual({fill: FILL, status: 'FILLED'});
  });

  it('reports a dead order that is neither open nor filled', async () => {
    const broker = createBrokerStub();
    broker.getFillByOrderId.mockResolvedValue(undefined);
    broker.getOpenOrders.mockResolvedValue([]);
    const deps = createDeps(broker);

    await expect(runCli(['wait', 'RRl_EQ', '42', '--broker', 'trading212', '--counter', 'GBX'], deps)).rejects.toThrow(
      'cancelled or rejected'
    );
    expect(
      broker.getFillByOrderId,
      'a vanished order must be re-checked for a fill before being declared dead'
    ).toHaveBeenCalledTimes(2);
  });

  it('times out while the order is still open and names the cancel command', async () => {
    const broker = createBrokerStub();
    broker.getFillByOrderId.mockResolvedValue(undefined);
    broker.getOpenOrders.mockResolvedValue([
      {id: '42', pair: RR_PAIR, price: '1000', side: OrderSide.BUY, size: '1', type: 'LIMIT'},
    ]);
    const deps = createDeps(broker);

    const timeout = runCli(
      ['wait', 'RRl_EQ', '42', '--broker', 'trading212', '--counter', 'GBX', '--timeout', '1ms'],
      deps
    );

    await expect(timeout).rejects.toThrow('cancel RRl_EQ 42');
  });

  it('validates and estimates instead of placing when --dry-run is given', async () => {
    const broker = createBrokerStub();
    broker.getTradingRules.mockResolvedValue({
      base_increment: '1',
      base_max_size: '1000',
      base_min_size: '1',
      counter_increment: '0.01',
      counter_min_size: '1',
      pair: RR_PAIR,
    });
    const fee = {commission: new Big(0), currencyConversion: new Big(2.24), feeAsset: 'EUR', total: new Big(2.24)};
    broker.estimateFee.mockResolvedValue(fee);
    const deps = createDeps(broker);

    const result = await runCli(
      ['buy', 'RRl_EQ', '1', '--broker', 'trading212', '--counter', 'GBX', '--limit', '1490', '--dry-run'],
      deps
    );

    expect(result.json).toMatchObject({dryRun: true, estimatedFee: fee});
    expect(broker.placeLimitOrder, 'a dry run must never place an order').not.toHaveBeenCalled();
    expect(broker.placeMarketOrder).not.toHaveBeenCalled();
  });

  it('fails a dry run whose size violates the trading rules', async () => {
    const broker = createBrokerStub();
    broker.getTradingRules.mockResolvedValue({
      base_increment: '1',
      base_max_size: '1000',
      base_min_size: '5',
      counter_increment: '0.01',
      counter_min_size: '1',
      pair: RR_PAIR,
    });
    const deps = createDeps(broker);

    const dryRun = runCli(
      ['buy', 'RRl_EQ', '1', '--broker', 'trading212', '--counter', 'GBX', '--limit', '1490', '--dry-run'],
      deps
    );

    await expect(dryRun).rejects.toThrow('below the minimum of 5');
  });

  it('streams candles as NDJSON events and stops after --take', async () => {
    const emitter = new EventEmitter();
    const candles = [{close: '100'}, {close: '101'}, {close: '102'}];
    const broker = {
      ...createBrokerStub(),
      off: emitter.off.bind(emitter),
      on: emitter.on.bind(emitter),
      unwatchCandles: vi.fn(),
      watchCandles: vi.fn().mockImplementation(() => {
        setTimeout(() => candles.forEach(candle => emitter.emit('topic-1', candle)), 0);
        return Promise.resolve('topic-1');
      }),
    };
    const deps = createDeps(broker);

    const result = await runCli(
      ['watch-candles', 'RRl_EQ', '--broker', 'trading212', '--counter', 'GBX', '--take', '2'],
      deps
    );

    expect(result.json).toEqual({events: 2});
    expect(deps.writeEvent, 'the stream must stop at --take, not drain every event').toHaveBeenCalledTimes(2);
    expect(deps.writeEvent).toHaveBeenNthCalledWith(1, JSON.stringify(candles[0]));
    expect(broker.unwatchCandles).toHaveBeenCalledWith('topic-1');
  });

  it('locks the Alpaca stream slot for the whole watch and releases it afterwards', async () => {
    const emitter = new EventEmitter();
    const broker = {
      ...createBrokerStub(),
      off: emitter.off.bind(emitter),
      on: emitter.on.bind(emitter),
      unwatchCandles: vi.fn(),
      watchCandles: vi.fn().mockImplementation(() => {
        setTimeout(() => emitter.emit('topic-1', {close: '1'}), 0);
        return Promise.resolve('topic-1');
      }),
    };
    const deps = createDeps(broker);

    await runCli(['watch-candles', 'RRl_EQ', '--broker', 'trading212', '--counter', 'GBX', '--take', '1'], deps);

    expect(
      deps.acquireStreamLock,
      'Trading212 candle streams ride the Alpaca socket, so they must hold the Alpaca-key lock'
    ).toHaveBeenCalledWith('alpaca-key');
    expect(deps.releaseStreamLock).toHaveBeenCalledTimes(1);
  });

  it('releases the stream lock when the watch fails', async () => {
    const broker = {
      ...createBrokerStub(),
      watchCandles: vi.fn().mockRejectedValue(new Error('subscribe failed')),
    };
    const deps = createDeps(broker);

    await expect(
      runCli(['watch-candles', 'RRl_EQ', '--broker', 'trading212', '--counter', 'GBX'], deps)
    ).rejects.toThrow('subscribe failed');
    expect(deps.releaseStreamLock).toHaveBeenCalledTimes(1);
  });

  it('does not lock for Trading212 order watching, which polls REST', async () => {
    const emitter = new EventEmitter();
    const broker = {
      ...createBrokerStub(),
      off: emitter.off.bind(emitter),
      on: emitter.on.bind(emitter),
      unwatchOrders: vi.fn(),
      watchOrders: vi.fn().mockImplementation(() => {
        setTimeout(() => emitter.emit('topic-2', {order_id: '1'}), 0);
        return Promise.resolve('topic-2');
      }),
    };
    const deps = createDeps(broker);

    await runCli(['watch-orders', '--broker', 'trading212', '--take', '1'], deps);

    expect(deps.acquireStreamLock).not.toHaveBeenCalled();
  });

  it('fails a stream that stays silent past --idle', async () => {
    const broker = {
      ...createBrokerStub(),
      off: vi.fn(),
      on: vi.fn(),
      unwatchCandles: vi.fn(),
      watchCandles: vi.fn().mockResolvedValue('topic-1'),
    };
    const deps = createDeps(broker);

    const starved = runCli(
      ['watch-candles', 'RRl_EQ', '--broker', 'trading212', '--counter', 'GBX', '--idle', '1ms'],
      deps
    );

    await expect(starved, 'a subscribed-but-silent stream must fail instead of hanging forever').rejects.toThrow(
      'No events for 1ms'
    );
    expect(deps.releaseStreamLock).toHaveBeenCalledTimes(1);
    expect(broker.unwatchCandles).toHaveBeenCalledWith('topic-1');
  });

  it('rejects an invalid --idle before acquiring the stream lock', async () => {
    const broker = createBrokerStub();
    const deps = createDeps(broker);

    const invalid = runCli(
      ['watch-candles', 'RRl_EQ', '--broker', 'trading212', '--counter', 'GBX', '--idle', 'banana'],
      deps
    );

    await expect(invalid).rejects.toThrow('Invalid --idle');
    expect(deps.acquireStreamLock, 'a flag parse error must never leak the lock file').not.toHaveBeenCalled();
  });

  it('names the flag that failed duration parsing', async () => {
    const broker = createBrokerStub();
    const deps = createDeps(broker);
    await expect(
      runCli(['wait', 'RRl_EQ', '42', '--broker', 'trading212', '--counter', 'GBX', '--timeout', 'banana'], deps)
    ).rejects.toThrow('Invalid --timeout');
  });

  it('marks the watch summary as compact so stdout stays NDJSON', async () => {
    const emitter = new EventEmitter();
    const broker = {
      ...createBrokerStub(),
      off: emitter.off.bind(emitter),
      on: emitter.on.bind(emitter),
      unwatchCandles: vi.fn(),
      watchCandles: vi.fn().mockImplementation(() => {
        setTimeout(() => emitter.emit('topic-1', {close: '1'}), 0);
        return Promise.resolve('topic-1');
      }),
    };
    const deps = createDeps(broker);

    const result = await runCli(
      ['watch-candles', 'RRl_EQ', '--broker', 'trading212', '--counter', 'GBX', '--take', '1'],
      deps
    );

    expect(result.compact, 'a pretty-printed summary would break one-JSON-object-per-line output').toBe(true);
  });

  it('rejects an interval that is not a duration', async () => {
    const broker = createBrokerStub();
    const deps = createDeps(broker);
    await expect(
      runCli(['candles', 'RRl_EQ', '--broker', 'trading212', '--counter', 'GBX', '--interval', 'banana'], deps)
    ).rejects.toThrow('Invalid --interval');
  });

  it('disconnects the broker even when the command fails', async () => {
    const broker = createBrokerStub();
    broker.listBalances.mockRejectedValue(new Error('boom'));
    const deps = createDeps(broker);

    await expect(runCli(['balances', '--broker', 'trading212'], deps)).rejects.toThrow('boom');
    expect(broker.disconnect).toHaveBeenCalledTimes(1);
  });
});
