import {parseArgs} from 'node:util';
import {setTimeout as sleep} from 'node:timers/promises';
import Big from 'big.js';
import {ms, type StringValue} from 'ms';
import type {Broker} from '../broker/Broker.js';
import {OrderSide, OrderType} from '../broker/Broker.js';
import type {MarketDataSource} from '../broker/MarketDataSource.js';
import {TradingPair} from '../broker/TradingPair.js';
import {BROKERS, createCliBroker} from './cliBroker.js';

export const USAGE = `Usage: exchange-cli <command> --broker <alpaca|trading212> [options]

Commands:
  verify                         Check credentials
  balances                       List cash and positions
  instruments <query>            Search equities by ticker, name, or ISIN
  quote <ticker>                 Latest candle close (not a bid/ask quote)
  rules <ticker>                 Trading rules
  orders <ticker>                Open orders
  fills <ticker>                 Order fills
  buy|sell <ticker> <quantity>    Market order; --limit <price> for a limit order
  wait <ticker> <orderId>         Wait for a fill or for the order to close
  cancel <ticker> <orderId>       Cancel one order; --all cancels all for the ticker
  candles <ticker>               Recent candles
  watch-candles <ticker>          Stream candles as NDJSON
  watch-orders                   Stream fills as NDJSON
  time                           Broker time

Options:
  --live                         Use live credentials and trading (default: paper)
  --counter <currency>           Skip currency lookup (Alpaca defaults to USD)
  --dry-run                      With buy/sell: check size rules and estimate fees
  --limit <price>                With buy/sell: limit price
  --all                          With cancel: cancel every open order for the ticker
  --interval <duration>          Candle interval (default: 1m)
  --count <n>                     Number of candles (default: 10)
  --take <n>                      Stop streaming after n events (default: until Ctrl-C)
  --timeout <duration>           Wait deadline (default: 5m); does not cancel the order
  --poll <duration>              Wait poll interval (default: broker rate limit)
  --help                         Print this help without connecting

Credentials: <BROKER>_PAPER_API_KEY and <BROKER>_PAPER_API_SECRET, or
<BROKER>_LIVE_API_KEY and <BROKER>_LIVE_API_SECRET with --live.
For example: ALPACA_PAPER_API_KEY. Set them in the environment or use Node's
--env-file option. Market-data commands are available with Alpaca.
Results are JSON on stdout; failures go to stderr with exit code 1.`;

// Keep validation local to the CLI; broker APIs remain responsible for trading behavior.
const COMMAND_ARGS: Record<string, number> = {
  balances: 0,
  buy: 2,
  cancel: 2,
  candles: 1,
  fills: 1,
  instruments: 1,
  orders: 1,
  quote: 1,
  rules: 1,
  sell: 2,
  time: 0,
  verify: 0,
  wait: 2,
  'watch-candles': 1,
  'watch-orders': 0,
};

export interface CliDeps {
  createBroker: typeof createCliBroker;
  env: NodeJS.ProcessEnv;
  writeEvent: (line: string) => void;
}

type CliResult = {text: string} | {json: unknown};
type Client = Broker & MarketDataSource;

function isDuration(value: string): value is StringValue {
  return /^\d+\s?(ms|s|m|h|d|w)$/.test(value);
}

function duration(value: string, flag: string): number {
  if (!isDuration(value) || !Number.isSafeInteger(ms(value)) || ms(value) <= 0 || ms(value) > 2_147_483_647) {
    throw new Error(`Invalid ${flag} "${value}". Use a positive duration up to 24 days, e.g. 1m or 5s.`);
  }
  return ms(value);
}

function positiveInt(value: string, flag: string): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) {
    throw new Error(`Invalid ${flag} "${value}". Use a positive integer.`);
  }
  return number;
}

function positiveDecimal(value: string, name: string): Big {
  try {
    const number = new Big(value);
    if (number.gt(0)) {
      return number;
    }
  } catch {
    // Report the CLI argument rather than big.js internals.
  }
  throw new Error(`Invalid ${name} "${value}". Use a positive decimal.`);
}

async function previewOrder(broker: Client, pair: TradingPair, side: OrderSide, size: string, limit?: string) {
  const quantity = positiveDecimal(size, 'quantity');
  const rules = await broker.getTradingRules(pair);
  if (quantity.lt(rules.base_min_size) || quantity.gt(rules.base_max_size)) {
    throw new Error(`Quantity must be between ${rules.base_min_size} and ${rules.base_max_size}.`);
  }
  if (new Big(rules.base_increment).gt(0) && !quantity.mod(rules.base_increment).eq(0)) {
    throw new Error(`Quantity must be a multiple of ${rules.base_increment}.`);
  }
  const price = limit
    ? new Big(limit)
    : new Big((await broker.getLatestCandle(pair, broker.getSmallestInterval())).close);
  const notional = price.times(quantity);
  return {
    dryRun: true,
    estimatedFee: await broker.estimateFee(pair, limit ? OrderType.LIMIT : OrderType.MARKET, notional),
    estimatedNotional: notional,
    order: {pair, price: limit, side, size, type: limit ? OrderType.LIMIT : OrderType.MARKET},
    rules,
  };
}

async function waitForOrder(broker: Client, pair: TradingPair, id: string, timeout: number, poll: number) {
  const deadline = Date.now() + timeout;
  for (;;) {
    const fill = await broker.getFillByOrderId(pair, id);
    if (fill) {
      return {fill, status: 'FILLED'};
    }
    const open = (await broker.getOpenOrders(pair)).some(order => order.id === id);
    if (!open) {
      // Account for a fill arriving between the fill and open-order requests.
      const lateFill = await broker.getFillByOrderId(pair, id);
      if (lateFill) {
        return {fill: lateFill, status: 'FILLED'};
      }
      throw new Error(`Order ${id} is no longer open and has no fill (cancelled or rejected).`);
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      throw new Error(`Order ${id} is still open after ${timeout}ms. The timeout does not cancel it.`);
    }
    await sleep(Math.min(poll, remaining));
  }
}

async function watch(
  broker: Client,
  subscribe: () => Promise<string>,
  unsubscribe: (topic: string) => void,
  take: number,
  write: (line: string) => void
) {
  const topic = await subscribe();
  let count = 0;
  let listener: (event: unknown) => void = () => {};
  let onError: (error: Error) => void = () => {};
  try {
    await new Promise<void>((resolve, reject) => {
      onError = reject;
      listener = event => {
        try {
          write(JSON.stringify(event));
          if (++count >= take) {
            broker.off(topic, listener);
            resolve();
          }
        } catch (error) {
          reject(error);
        }
      };
      broker.on(topic, listener);
      broker.on('error', onError);
    });
    return {events: count};
  } finally {
    broker.off(topic, listener);
    broker.off('error', onError);
    unsubscribe(topic);
  }
}

/** Parse and dispatch one command; the executable alone owns stdout/stderr and process exit. */
export async function runCli(argv: string[], overrides: Partial<CliDeps> = {}): Promise<CliResult> {
  const {positionals, values} = parseArgs({
    allowPositionals: true,
    args: argv,
    options: {
      all: {type: 'boolean'},
      broker: {type: 'string'},
      count: {type: 'string'},
      counter: {type: 'string'},
      'dry-run': {type: 'boolean'},
      help: {short: 'h', type: 'boolean'},
      interval: {type: 'string'},
      limit: {type: 'string'},
      live: {type: 'boolean'},
      poll: {type: 'string'},
      take: {type: 'string'},
      timeout: {type: 'string'},
    },
  });
  const [command, ...args] = positionals;
  if (!command || command === 'help' || values.help) {
    return {text: USAGE};
  }
  if (!Object.hasOwn(COMMAND_ARGS, command)) {
    throw new Error(`Unknown command "${command}". Run "exchange-cli help" for usage.`);
  }
  const expected = command === 'cancel' && values.all ? 1 : COMMAND_ARGS[command];
  if (args.length !== expected || args.some(arg => !arg.trim())) {
    throw new Error(`Expected ${expected} argument(s) for "${command}". Run "exchange-cli help" for usage.`);
  }
  for (const [flag, commands] of Object.entries({
    all: ['cancel'],
    count: ['candles'],
    'dry-run': ['buy', 'sell'],
    interval: ['candles', 'watch-candles'],
    limit: ['buy', 'sell'],
    poll: ['wait'],
    take: ['watch-candles', 'watch-orders'],
    timeout: ['wait'],
  })) {
    if (Object.hasOwn(values, flag) && !commands.includes(command)) {
      throw new Error(`--${flag} only applies to: ${commands.join(', ')}.`);
    }
  }
  const key = values.broker?.toLowerCase();
  if (key !== 'alpaca' && key !== 'trading212') {
    throw new Error('Missing or unknown --broker. Choose alpaca or trading212.');
  }
  const interval = duration(values.interval ?? '1m', '--interval');
  const timeout = duration(values.timeout ?? '5m', '--timeout');
  const poll = values.poll !== undefined ? duration(values.poll, '--poll') : BROKERS[key].pollInterval;
  const count = positiveInt(values.count ?? '10', '--count');
  const take = values.take !== undefined ? positiveInt(values.take, '--take') : Infinity;
  if (command === 'buy' || command === 'sell') {
    positiveDecimal(args[1], 'quantity');
    if (values.limit !== undefined) {
      positiveDecimal(values.limit, '--limit');
    }
  }

  const {broker, listInstruments} = (overrides.createBroker ?? createCliBroker)(
    key,
    values.live ?? false,
    overrides.env ?? process.env
  );
  const write = overrides.writeEvent ?? (line => process.stdout.write(`${line}\n`));
  try {
    switch (command) {
      case 'verify':
        await broker.verifyCredentials();
        return {json: {broker: BROKERS[key].id, environment: values.live ? 'live' : 'paper', ok: true}};
      case 'balances':
        return {json: await broker.listBalances()};
      case 'time':
        return {json: {time: await broker.getTime()}};
      case 'instruments': {
        const query = args[0].toLowerCase();
        return {
          json: (await listInstruments()).filter(instrument =>
            [instrument.ticker, instrument.name, instrument.isin ?? ''].some(field =>
              field.toLowerCase().includes(query)
            )
          ),
        };
      }
      case 'watch-orders':
        return {
          json: await watch(
            broker,
            () => broker.watchOrders(),
            topic => broker.unwatchOrders(topic),
            take,
            write
          ),
        };
    }

    const ticker = args[0];
    const counter =
      values.counter ??
      (key === 'alpaca' ? 'USD' : (await listInstruments()).find(instrument => instrument.ticker === ticker)?.currency);
    if (!counter?.trim()) {
      throw new Error(`Cannot resolve currency for "${ticker}". Use instruments <query> or --counter <currency>.`);
    }
    const pair = new TradingPair(ticker, counter);
    switch (command) {
      case 'quote': {
        const candle = await broker.getLatestCandle(pair, broker.getSmallestInterval());
        return {json: {base: pair.base, counter: pair.counter, price: candle.close, time: candle.openTimeInISO}};
      }
      case 'candles':
        return {json: await broker.getRecentCandles(pair, count, interval)};
      case 'rules':
        return {json: await broker.getTradingRules(pair)};
      case 'orders':
        return {json: await broker.getOpenOrders(pair)};
      case 'fills':
        return {json: await broker.getFills(pair)};
      case 'buy':
      case 'sell': {
        const side = command === 'buy' ? OrderSide.BUY : OrderSide.SELL;
        const size = args[1];
        if (values['dry-run']) {
          return {json: await previewOrder(broker, pair, side, size, values.limit)};
        }
        return {
          json: values.limit
            ? await broker.placeLimitOrder(pair, {price: values.limit, side, size})
            : await broker.placeMarketOrder(pair, {side, size, sizeInCounter: false}),
        };
      }
      case 'cancel':
        if (values.all) {
          return {json: {cancelled: await broker.cancelOpenOrders(pair)}};
        }
        await broker.cancelOrderById(pair, args[1]);
        return {json: {cancelled: [args[1]]}};
      case 'wait':
        return {json: await waitForOrder(broker, pair, args[1], timeout, poll)};
      case 'watch-candles':
        return {
          json: await watch(
            broker,
            () => broker.watchCandles(pair, interval, new Date().toISOString()),
            topic => broker.unwatchCandles(topic),
            take,
            write
          ),
        };
      default:
        throw new Error(`Unknown command "${command}".`);
    }
  } finally {
    broker.disconnect();
  }
}
