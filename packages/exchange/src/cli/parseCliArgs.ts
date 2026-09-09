import {parseArgs} from 'node:util';
import Big from 'big.js';
import {ms, type StringValue} from 'ms';
import {BROKERS} from './cliBroker.js';

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
  --dry-run                      With buy/sell: check trading rules and estimate fees
  --limit <price>                With buy/sell: limit price
  --all                          With cancel: cancel every open order for the ticker
  --interval <duration>          Candle interval: 1-59m, 1-23h, or 1d (default: 1m)
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

function isDuration(value: string): value is StringValue {
  return /^\d+\s?(ms|s|m|h|d|w)$/.test(value);
}

function duration(value: string, flag: string): number {
  if (!isDuration(value) || !Number.isSafeInteger(ms(value)) || ms(value) <= 0 || ms(value) > 2_147_483_647) {
    throw new Error(`Invalid ${flag} "${value}". Use a positive duration up to 24 days, e.g. 1m or 5s.`);
  }
  return ms(value);
}

function candleInterval(value: string): number {
  const interval = duration(value, '--interval');
  /*
   * Alpaca's current mapper rounds durations to their largest unit. Keep REST candles
   * and streaming batches on the same exact interval, with one-minute source bars.
   */
  const unit = interval < ms('1h') ? ms('1m') : ms('1h');
  if (interval < ms('1m') || interval > ms('1d') || interval % unit !== 0) {
    throw new Error(`Invalid --interval "${value}". Use whole minutes (1-59m), whole hours (1-23h), or 1d.`);
  }
  return interval;
}

function positiveInt(value: string, flag: string): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) {
    throw new Error(`Invalid ${flag} "${value}". Use a positive integer.`);
  }
  return number;
}

function validateDecimal(value: string, name: string): void {
  try {
    const number = new Big(value);
    if (number.gt(0)) {
      return;
    }
  } catch {
    // Report the CLI argument rather than big.js internals.
  }
  throw new Error(`Invalid ${name} "${value}". Use a positive decimal.`);
}

/** Validate the complete invocation before constructing a broker. */
export function parseCliArgs(argv: string[]) {
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
    return undefined;
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
  const interval = candleInterval(values.interval ?? '1m');
  const timeout = duration(values.timeout ?? '5m', '--timeout');
  const poll = values.poll !== undefined ? duration(values.poll, '--poll') : BROKERS[key].pollInterval;
  const count = positiveInt(values.count ?? '10', '--count');
  const take = values.take !== undefined ? positiveInt(values.take, '--take') : Infinity;
  if (command === 'buy' || command === 'sell') {
    validateDecimal(args[1], 'quantity');
    if (values.limit !== undefined) {
      validateDecimal(values.limit, '--limit');
    }
  }

  return {args, command, count, interval, key, poll, take, timeout, values} as const;
}
