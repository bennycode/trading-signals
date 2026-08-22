import {parseArgs} from 'node:util';
import Big from 'big.js';
import {ms, type StringValue} from 'ms';
import type {Broker, Candle} from '../broker/Broker.js';
import {OrderSide, OrderType} from '../broker/Broker.js';
import {getBrokerClient} from '../broker/getBrokerClient.js';
import {MarketDataSource} from '../broker/MarketDataSource.js';
import {TradingPair} from '../broker/TradingPair.js';
import {AlpacaAPI} from '../broker/alpaca/api/AlpacaAPI.js';
import {AlpacaBroker} from '../broker/alpaca/AlpacaBroker.js';
import {AlpacaMarketData} from '../broker/alpaca/AlpacaMarketData.js';
import {AlpacaAssetClass} from '../broker/alpaca/api/schema/OrderSchema.js';
import {Trading212API} from '../broker/trading212/api/Trading212API.js';
import {Trading212Broker} from '../broker/trading212/Trading212Broker.js';
import {acquireStreamLock} from './processLock.js';

export const BROKER_KEYS = ['alpaca', 'trading212'] as const;
export type BrokerKey = (typeof BROKER_KEYS)[number];

const BROKER_IDS: Record<BrokerKey, string> = {
  alpaca: AlpacaBroker.NAME,
  trading212: Trading212Broker.NAME,
};

const ENV_PREFIXES: Record<BrokerKey, string> = {
  alpaca: 'ALPACA',
  trading212: 'TRADING212',
};

interface Credentials {
  apiKey: string;
  apiSecret: string;
}

/** Broker-neutral instrument metadata for the `instruments` command and counter-currency resolution. */
export interface InstrumentInfo {
  currency: string;
  isin?: string;
  name: string;
  ticker: string;
  type?: string;
}

export interface CliDeps {
  /** Cross-process guard for Alpaca's one-stream-per-key limit; returns a release function. */
  acquireStreamLock: typeof acquireStreamLock;
  env: NodeJS.ProcessEnv;
  getBroker: typeof getBrokerClient;
  listInstruments: (broker: BrokerKey, credentials: Credentials, usePaperTrading: boolean) => Promise<InstrumentInfo[]>;
  /** Sink for streaming (`watch-*`) events; one NDJSON line per event. Defaults to stdout. */
  writeEvent: (line: string) => void;
}

/** Exactly one of `text` (help output) and `json` (command results) is set. */
export interface CliResult {
  /** Print `json` compactly on a single line — set by watch-* commands so the closing summary keeps the NDJSON contract. */
  compact?: boolean;
  json?: unknown;
  text?: string;
}

interface CommandSpec {
  /** Positional arguments as shown in the usage, e.g. "<ticker> <quantity>". */
  args?: string;
  description: string;
}

/** Every dispatchable command, in workflow order (which is also the display order in the usage text). */
const COMMANDS: readonly (readonly [name: string, spec: CommandSpec])[] = [
  ['verify', {description: 'Check that the credentials authenticate'}],
  ['balances', {description: 'List positions and cash'}],
  ['instruments', {args: '<query>', description: 'Search tradable instruments by ticker/name/ISIN'}],
  ['rules', {args: '<ticker>', description: 'Trading rules (min size, increments) for an instrument'}],
  ['orders', {args: '<ticker>', description: 'List open orders for an instrument'}],
  ['fills', {args: '<ticker>', description: 'List filled orders for an instrument'}],
  ['quote', {args: '<ticker>', description: 'Latest price for an instrument'}],
  ['buy', {args: '<ticker> <quantity>', description: 'Place a market BUY (or limit with --limit)'}],
  ['sell', {args: '<ticker> <quantity>', description: 'Place a market SELL (or limit with --limit)'}],
  ['wait', {args: '<ticker> <orderId>', description: 'Poll until the order fills or dies (--timeout, --poll)'}],
  ['cancel', {args: '<ticker> <orderId>', description: 'Cancel one order (or all for the ticker with --all)'}],
  ['candles', {args: '<ticker>', description: 'Most recent candles (--interval, --count)'}],
  ['watch-candles', {args: '<ticker>', description: 'Stream live candles as NDJSON until Ctrl-C (or --take)'}],
  ['watch-orders', {description: 'Stream order fills as NDJSON until Ctrl-C (or --take)'}],
  ['time', {description: 'Broker time'}],
];

const COMMAND_NAMES = new Set(COMMANDS.map(([name]) => name));

/** The `parseArgs` configuration; kept as a plain literal so `values` stays precisely typed. */
const CLI_OPTIONS = {
  all: {default: false, type: 'boolean'},
  broker: {type: 'string'},
  count: {type: 'string'},
  counter: {type: 'string'},
  'dry-run': {default: false, type: 'boolean'},
  idle: {type: 'string'},
  interval: {default: '1m', type: 'string'},
  limit: {type: 'string'},
  live: {default: false, type: 'boolean'},
  poll: {type: 'string'},
  take: {type: 'string'},
  timeout: {default: '5m', type: 'string'},
} as const;

/**
 * Help metadata for every CLI option. Keyed by `keyof typeof CLI_OPTIONS`, so adding an
 * option without help (or help without an option) fails to compile.
 */
const OPTION_HELP: Record<keyof typeof CLI_OPTIONS, {description: string; placeholder?: string}> = {
  all: {description: 'With cancel: cancel every open order for the ticker'},
  broker: {description: `Required. One of: ${BROKER_KEYS.join(', ')}`, placeholder: '<name>'},
  count: {description: 'Number of candles to fetch (default: 10)', placeholder: '<n>'},
  counter: {description: 'Counter currency of the pair (skips the instrument lookup)', placeholder: '<currency>'},
  'dry-run': {description: 'With buy/sell: validate against trading rules and estimate fees without placing the order'},
  idle: {
    description:
      'Fail a watch-* stream when no event arrives within this window (catches a starved stream: Alpaca serves one market-data connection per API key, and a newer one silently takes over)',
    placeholder: '<duration>',
  },
  interval: {description: 'Candle interval, e.g. 1m, 5m, 1h (default: 1m)', placeholder: '<duration>'},
  limit: {description: 'Turn buy/sell into a limit order at this price', placeholder: '<price>'},
  live: {description: 'Use the LIVE account (default: paper)'},
  poll: {description: "With wait: poll interval (default: matches the broker's rate limit)", placeholder: '<duration>'},
  take: {description: 'Stop a watch-* stream after n events (default: run until Ctrl-C)', placeholder: '<n>'},
  timeout: {
    description: 'With wait: give up after this long (default: 5m); the order stays open on timeout',
    placeholder: '<duration>',
  },
};

const USAGE_FOOTER = `Credentials come from <BROKER>_PAPER_API_KEY + <BROKER>_PAPER_API_SECRET (or the _LIVE_
pair) environment variables, e.g. TRADING212_PAPER_API_KEY and TRADING212_PAPER_API_SECRET.
--live loads them from .env.live, otherwise from .env.sandbox (both optional; variables
already present in the environment win). Output is JSON on stdout; watch-* commands emit
one JSON object per line as events arrive.

Trading212 has no market data of its own: candle commands source it from Alpaca using the
ALPACA_* credentials matching the execution environment (falling back to the other pair,
since market data is read-only).`;

const USAGE_WIDTH = 100;

/** Renders "  left  right" rows with a shared column for `right`, wrapping long descriptions. */
function renderRows(rows: [left: string, right: string][]): string {
  const column = Math.max(...rows.map(([left]) => left.length)) + 2;
  return rows
    .map(([left, right]) => {
      const prefix = `  ${left.padEnd(column)}`;
      const lineWidth = Math.max(USAGE_WIDTH - prefix.length, 40);
      const lines: string[] = [];
      let line = '';
      for (const word of right.split(' ')) {
        if (line && line.length + word.length + 1 > lineWidth) {
          lines.push(line);
          line = word;
        } else {
          line = line ? `${line} ${word}` : word;
        }
      }
      lines.push(line);
      return prefix + lines.join(`\n${' '.repeat(prefix.length)}`);
    })
    .join('\n');
}

function renderUsage(): string {
  const commandRows = COMMANDS.map(([name, spec]): [string, string] => [
    spec.args ? `${name} ${spec.args}` : name,
    spec.description,
  ]);
  const optionRows = Object.entries(OPTION_HELP).map(([name, help]): [string, string] => [
    help.placeholder ? `--${name} ${help.placeholder}` : `--${name}`,
    help.description,
  ]);
  return [
    `Usage: exchange-cli <command> --broker <${BROKER_KEYS.join('|')}> [options]`,
    '',
    'Commands:',
    renderRows(commandRows),
    '',
    'Options:',
    renderRows(optionRows),
    '',
    USAGE_FOOTER,
  ].join('\n');
}

export const USAGE = renderUsage();

/**
 * Fallback for brokers that need an external market-data source (Trading212) when no
 * Alpaca credentials are configured: non-candle commands keep working, candle commands
 * fail with a pointer to the missing configuration.
 */
class UnavailableMarketDataSource extends MarketDataSource {
  static readonly REASON =
    'No market-data source configured. Trading212 has no market data of its own — set ALPACA_PAPER_API_KEY and ALPACA_PAPER_API_SECRET (or the ALPACA_LIVE_* pair) to source candles from Alpaca.';

  async getCandles(): Promise<Candle[]> {
    throw new Error(UnavailableMarketDataSource.REASON);
  }

  async getLatestCandle(): Promise<Candle> {
    throw new Error(UnavailableMarketDataSource.REASON);
  }

  watchCandles(): Promise<string> {
    return Promise.reject(new Error(UnavailableMarketDataSource.REASON));
  }

  unwatchCandles(): void {}

  disconnect(): void {}
}

function isBrokerKey(value: string): value is BrokerKey {
  return (BROKER_KEYS as readonly string[]).includes(value);
}

function isIntervalString(value: string): value is StringValue {
  return /^\d+\s?(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)$/i.test(
    value
  );
}

function parseInterval(value: string, flag: string): number {
  if (!isIntervalString(value)) {
    throw new Error(`Invalid ${flag} "${value}". Use a duration like 1m, 5m, or 1h.`);
  }
  return ms(value);
}

function parsePositiveInt(value: string, flag: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${flag} "${value}". Use a positive integer.`);
  }
  return parsed;
}

/**
 * Default `wait` poll intervals, matching each broker's documented rate limit for the
 * order-history endpoint that `getFillByOrderId` hits.
 */
const DEFAULT_WAIT_POLL_MS: Record<BrokerKey, number> = {
  alpaca: ms('5s'),
  trading212: Trading212Broker.ORDER_POLL_INTERVAL_MS,
};

function sleep(millis: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, millis));
}

/**
 * Subscribe, stream events as NDJSON, and tear down. `acquireLock` (when given) is taken
 * BEFORE the socket opens and released on every exit path — see `acquireStreamLock` for why.
 * `idle` arms a watchdog that fails the stream when no event arrives within the window:
 * a subscribed-but-silent stream usually means another connection with the same Alpaca key
 * took over the single data slot, which is otherwise indistinguishable from a quiet market.
 */
async function watchStream(options: {
  acquireLock?: () => () => void;
  broker: Broker & MarketDataSource;
  idle: string | undefined;
  subscribe: () => Promise<string>;
  take: number;
  unsubscribe: (topicId: string) => void;
  writeEvent: (line: string) => void;
}): Promise<number> {
  // Validate flags before taking the lock, so a parse error cannot leak the lock file.
  const idleMillis = options.idle ? parseInterval(options.idle, '--idle') : undefined;
  const releaseLock = options.acquireLock?.();
  let idleTimer: NodeJS.Timeout | undefined;
  let topicId: string | undefined;
  let events = 0;

  try {
    topicId = await options.subscribe();
    const activeTopicId = topicId;
    await new Promise<void>((resolve, reject) => {
      const armIdleTimer = () => {
        if (idleMillis === undefined) {
          return;
        }
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          reject(
            new Error(
              `No events for ${options.idle}. The stream may be starved: Alpaca serves one market-data ` +
                `connection per API key, and a newer connection (another CLI run or a deployed bot) ` +
                `silently takes over the data slot.`
            )
          );
        }, idleMillis);
      };
      armIdleTimer();

      const listener = (event: unknown) => {
        options.writeEvent(JSON.stringify(event));
        events += 1;
        armIdleTimer();
        if (events >= options.take) {
          // Detach before resolving so events arriving in the same tick aren't emitted past --take.
          options.broker.off(activeTopicId, listener);
          resolve();
        }
      };
      options.broker.on(activeTopicId, listener);
      options.broker.on('error', reject);
    });
  } finally {
    clearTimeout(idleTimer);
    if (topicId !== undefined) {
      options.unsubscribe(topicId);
    }
    releaseLock?.();
  }
  return events;
}

/**
 * Poll until the order reaches a terminal state: returns the fill when it fills, throws
 * when it disappears without a fill (cancelled or rejected) or when the timeout elapses
 * while it is still open. The neutral `Broker` interface has no order-status endpoint, so
 * "terminal" is derived from `getFillByOrderId` + `getOpenOrders`.
 */
async function waitForOrder(
  broker: Broker & MarketDataSource,
  pair: TradingPair,
  orderId: string,
  pollMillis: number,
  timeout: string
) {
  const deadline = Date.now() + parseInterval(timeout, '--timeout');

  for (;;) {
    const fill = await broker.getFillByOrderId(pair, orderId);
    if (fill) {
      return {fill, status: 'FILLED'};
    }
    const stillOpen = (await broker.getOpenOrders(pair)).some(order => order.id === orderId);
    if (!stillOpen) {
      // The order may have filled between the two calls — check once more before declaring it dead.
      const lateFill = await broker.getFillByOrderId(pair, orderId);
      if (lateFill) {
        return {fill: lateFill, status: 'FILLED'};
      }
      throw new Error(`Order ${orderId} is no longer open and has no fill — cancelled or rejected.`);
    }
    const remainingMillis = deadline - Date.now();
    if (remainingMillis <= 0) {
      throw new Error(
        `Order ${orderId} is still open after ${timeout}. It remains open — cancel it with: cancel ${pair.base} ${orderId}`
      );
    }
    // Never sleep past the deadline, so short timeouts still get a final poll before giving up.
    await sleep(Math.min(pollMillis, remainingMillis));
  }
}

/**
 * Validate an order against the instrument's trading rules and estimate its fees without
 * placing it. Market orders are priced off the latest candle close; limit orders off the
 * limit price. Throws when the size violates the rules — the order would be rejected anyway.
 */
async function dryRunOrder(
  broker: Broker & MarketDataSource,
  pair: TradingPair,
  side: OrderSide,
  size: string,
  limitPrice: string | undefined
) {
  const orderType = limitPrice ? OrderType.LIMIT : OrderType.MARKET;
  const rules = await broker.getTradingRules(pair);
  const price = limitPrice
    ? new Big(limitPrice)
    : new Big((await broker.getLatestCandle(pair, broker.getSmallestInterval())).close);

  const violations: string[] = [];
  const quantity = new Big(size);
  if (quantity.lt(rules.base_min_size)) {
    violations.push(`Size ${size} is below the minimum of ${rules.base_min_size}.`);
  }
  if (quantity.gt(rules.base_max_size)) {
    violations.push(`Size ${size} exceeds the maximum of ${rules.base_max_size}.`);
  }
  if (new Big(rules.base_increment).gt(0) && !quantity.mod(rules.base_increment).eq(0)) {
    violations.push(`Size ${size} is not a multiple of the increment ${rules.base_increment}.`);
  }
  if (violations.length > 0) {
    throw new Error(`Dry run failed:\n- ${violations.join('\n- ')}`);
  }

  const notional = price.times(quantity);
  return {
    dryRun: true,
    estimatedFee: await broker.estimateFee(pair, orderType, notional),
    estimatedNotional: notional,
    order: {pair, price: limitPrice, side, size, type: orderType},
    rules,
  };
}

/** Trading212 has no market data of its own, so its candle commands are fed from Alpaca. */
function getTrading212MarketData(env: NodeJS.ProcessEnv, live: boolean): MarketDataSource {
  const alpacaCredentials = getAlpacaMarketDataCredentials(env, live);
  if (!alpacaCredentials) {
    return new UnavailableMarketDataSource();
  }
  return new AlpacaMarketData(alpacaCredentials);
}

/**
 * The Alpaca credential set that feeds Trading212's market data. Prefers the pair matching
 * the execution environment — live execution should run on live-grade data, and Alpaca's
 * sandbox stream host is a test environment with no real-time guarantee. Falls back to the
 * other pair when the preferred one is not configured: market data is read-only, so
 * borrowing the other environment's keys is safe and beats having no candles at all.
 */
function getAlpacaMarketDataCredentials(
  env: NodeJS.ProcessEnv,
  live: boolean
): (Credentials & {usePaperTrading: boolean}) | undefined {
  const infixes = live ? (['LIVE', 'PAPER'] as const) : (['PAPER', 'LIVE'] as const);
  for (const infix of infixes) {
    const apiKey = env[`ALPACA_${infix}_API_KEY`];
    const apiSecret = env[`ALPACA_${infix}_API_SECRET`];
    if (apiKey && apiSecret) {
      return {apiKey, apiSecret, usePaperTrading: infix === 'PAPER'};
    }
  }
  return undefined;
}

function getCredentials(env: NodeJS.ProcessEnv, broker: BrokerKey, live: boolean): Credentials {
  const infix = live ? 'LIVE' : 'PAPER';
  const keyVar = `${ENV_PREFIXES[broker]}_${infix}_API_KEY`;
  const secretVar = `${ENV_PREFIXES[broker]}_${infix}_API_SECRET`;
  const apiKey = env[keyVar];
  const apiSecret = env[secretVar];
  if (!apiKey || !apiSecret) {
    throw new Error(`Missing ${keyVar} and/or ${secretVar} in environment.`);
  }
  return {apiKey, apiSecret};
}

async function listInstrumentsDefault(
  broker: BrokerKey,
  credentials: Credentials,
  usePaperTrading: boolean
): Promise<InstrumentInfo[]> {
  switch (broker) {
    case 'trading212': {
      const api = new Trading212API({...credentials, usePaperTrading});
      const instruments = await api.getInstruments();
      return instruments.map(instrument => ({
        currency: instrument.currencyCode,
        isin: instrument.isin ?? undefined,
        name: instrument.name,
        ticker: instrument.ticker,
        type: instrument.type,
      }));
    }
    case 'alpaca': {
      const api = new AlpacaAPI({...credentials, usePaperTrading});
      const assets = await api.getAssets({asset_class: AlpacaAssetClass.US_EQUITY});
      return assets.map(asset => ({
        currency: 'USD',
        name: asset.name,
        ticker: asset.symbol,
        type: asset.class,
      }));
    }
  }
}

export async function runCli(argv: string[], overrides: Partial<CliDeps> = {}): Promise<CliResult> {
  const deps: CliDeps = {
    acquireStreamLock: overrides.acquireStreamLock ?? acquireStreamLock,
    env: overrides.env ?? process.env,
    getBroker: overrides.getBroker ?? getBrokerClient,
    listInstruments: overrides.listInstruments ?? listInstrumentsDefault,
    writeEvent: overrides.writeEvent ?? console.log,
  };

  const {values, positionals} = parseArgs({
    allowPositionals: true,
    args: argv,
    options: CLI_OPTIONS,
  });

  const [command, ...args] = positionals;
  if (!command || command === 'help') {
    return {text: USAGE};
  }
  if (!COMMAND_NAMES.has(command)) {
    throw new Error(`Unknown command "${command}". Run "exchange-cli help" for usage.`);
  }

  if (!values.broker) {
    throw new Error(`Missing --broker. Choose one of: ${BROKER_KEYS.join(', ')}.`);
  }
  const brokerKey = values.broker.toLowerCase();
  if (!isBrokerKey(brokerKey)) {
    throw new Error(`Unknown broker "${values.broker}". Choose one of: ${BROKER_KEYS.join(', ')}.`);
  }

  const credentials = getCredentials(deps.env, brokerKey, values.live);
  const usePaperTrading = !values.live;

  const resolveCounter = async (ticker: string): Promise<string> => {
    if (values.counter) {
      return values.counter;
    }
    if (brokerKey === 'alpaca') {
      return 'USD';
    }
    const instruments = await deps.listInstruments(brokerKey, credentials, usePaperTrading);
    const match = instruments.find(instrument => instrument.ticker === ticker);
    if (!match) {
      throw new Error(`Unknown ${BROKER_IDS[brokerKey]} ticker "${ticker}". Search for it with: instruments <query>`);
    }
    return match.currency;
  };

  const requireArg = (name: string, index: number): string => {
    const value = args[index];
    if (!value) {
      throw new Error(`Missing <${name}> argument for "${command}". Run "exchange-cli help" for usage.`);
    }
    return value;
  };

  if (command === 'instruments') {
    const query = requireArg('query', 0).toLowerCase();
    const instruments = await deps.listInstruments(brokerKey, credentials, usePaperTrading);
    const matches = instruments.filter(instrument =>
      [instrument.ticker, instrument.name, instrument.isin ?? ''].some(field => field.toLowerCase().includes(query))
    );
    return {json: matches};
  }

  // Alpaca brings its own market data; Trading212 needs an external source (see getTrading212MarketData).
  const marketData = brokerKey === 'trading212' ? getTrading212MarketData(deps.env, values.live) : undefined;

  const broker = deps.getBroker(
    {
      apiKey: credentials.apiKey,
      apiSecret: credentials.apiSecret,
      exchangeId: BROKER_IDS[brokerKey],
      isPaper: usePaperTrading,
    },
    {marketData}
  );

  try {
    switch (command) {
      case 'verify': {
        await broker.verifyCredentials();
        return {json: {broker: BROKER_IDS[brokerKey], environment: values.live ? 'live' : 'paper', ok: true}};
      }
      case 'balances': {
        return {json: await broker.listBalances()};
      }
      case 'time': {
        return {json: {time: await broker.getTime()}};
      }
      case 'candles': {
        const ticker = requireArg('ticker', 0);
        const pair = new TradingPair(ticker, await resolveCounter(ticker));
        const count = parsePositiveInt(values.count ?? '10', '--count');
        return {json: await broker.getRecentCandles(pair, count, parseInterval(values.interval, '--interval'))};
      }
      case 'quote': {
        const ticker = requireArg('ticker', 0);
        const pair = new TradingPair(ticker, await resolveCounter(ticker));
        const candle = await broker.getLatestCandle(pair, broker.getSmallestInterval());
        return {
          json: {base: pair.base, counter: pair.counter, price: candle.close, time: candle.openTimeInISO},
        };
      }
      case 'wait': {
        const ticker = requireArg('ticker', 0);
        const orderId = requireArg('orderId', 1);
        const pair = new TradingPair(ticker, await resolveCounter(ticker));
        const pollMillis = values.poll ? parseInterval(values.poll, '--poll') : DEFAULT_WAIT_POLL_MS[brokerKey];
        return {json: await waitForOrder(broker, pair, orderId, pollMillis, values.timeout)};
      }
      case 'watch-candles':
      case 'watch-orders': {
        const isCandles = command === 'watch-candles';
        /*
         * Candle streams always ride an Alpaca WebSocket (Alpaca natively, Trading212 via
         * AlpacaMarketData); Alpaca order streams do too. Trading212 order watching polls
         * REST and needs no lock.
         */
        const alpacaStreamKey =
          brokerKey === 'alpaca' ? credentials.apiKey : getAlpacaMarketDataCredentials(deps.env, values.live)?.apiKey;
        const needsLock = isCandles || brokerKey === 'alpaca';
        const subscribe = isCandles
          ? async () => {
              const ticker = requireArg('ticker', 0);
              const pair = new TradingPair(ticker, await resolveCounter(ticker));
              return broker.watchCandles(pair, parseInterval(values.interval, '--interval'), new Date().toISOString());
            }
          : () => broker.watchOrders();

        const events = await watchStream({
          acquireLock: needsLock && alpacaStreamKey ? () => deps.acquireStreamLock(alpacaStreamKey) : undefined,
          broker,
          idle: values.idle,
          subscribe,
          take: values.take ? parsePositiveInt(values.take, '--take') : Infinity,
          unsubscribe: topicId => (isCandles ? broker.unwatchCandles(topicId) : broker.unwatchOrders(topicId)),
          writeEvent: deps.writeEvent,
        });
        return {compact: true, json: {events}};
      }
      case 'rules': {
        const ticker = requireArg('ticker', 0);
        const pair = new TradingPair(ticker, await resolveCounter(ticker));
        return {json: await broker.getTradingRules(pair)};
      }
      case 'orders': {
        const ticker = requireArg('ticker', 0);
        const pair = new TradingPair(ticker, await resolveCounter(ticker));
        return {json: await broker.getOpenOrders(pair)};
      }
      case 'fills': {
        const ticker = requireArg('ticker', 0);
        const pair = new TradingPair(ticker, await resolveCounter(ticker));
        return {json: await broker.getFills(pair)};
      }
      case 'buy':
      case 'sell': {
        const ticker = requireArg('ticker', 0);
        const size = requireArg('quantity', 1);
        const pair = new TradingPair(ticker, await resolveCounter(ticker));
        const side = command === 'buy' ? OrderSide.BUY : OrderSide.SELL;

        if (values['dry-run']) {
          return {json: await dryRunOrder(broker, pair, side, size, values.limit)};
        }

        const order = values.limit
          ? await broker.placeLimitOrder(pair, {price: values.limit, side, size})
          : await broker.placeMarketOrder(pair, {side, size, sizeInCounter: false});
        return {json: order};
      }
      case 'cancel': {
        const ticker = requireArg('ticker', 0);
        const pair = new TradingPair(ticker, await resolveCounter(ticker));
        if (values.all) {
          return {json: {cancelled: await broker.cancelOpenOrders(pair)}};
        }
        const orderId = requireArg('orderId', 1);
        await broker.cancelOrderById(pair, orderId);
        return {json: {cancelled: [orderId]}};
      }
      default:
        throw new Error(`Unknown command "${command}". Run "exchange-cli help" for usage.`);
    }
  } finally {
    broker.disconnect();
  }
}
