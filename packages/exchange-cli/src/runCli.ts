import {OrderSide, TradingPair} from '@typedtrader/exchange';
import {BROKERS, createCliBroker} from './cliBroker.js';
import {placeCliOrder, waitForOrder} from './cliOrders.js';
import {runSmokeChecks} from './cliSmoke.js';
import {parseCliArgs} from './parseCliArgs.js';
import {streamEvents} from './streamEvents.js';

export interface CliDeps {
  createBroker: typeof createCliBroker;
  env: NodeJS.ProcessEnv;
  writeEvent: (line: string) => void;
}

type CliResult = {text: string} | {code?: number; json: unknown};

/** A positional argument the command cannot run without, so its absence is a usage error. */
function argument(args: readonly string[], index: number, what: string): string {
  const value = args[index];
  if (value === undefined) {
    throw new Error(`Missing ${what}. Run with --help to see the command's arguments.`);
  }
  return value;
}

/** Dispatch one command and always release its broker; the executable owns process I/O. */
export async function runCli(argv: string[], overrides: Partial<CliDeps> = {}): Promise<CliResult> {
  const invocation = parseCliArgs(argv);
  if ('help' in invocation) {
    return {text: invocation.help};
  }
  const {args, command, count, interval, key, poll, take, timeout, values} = invocation;
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
        const search = argument(args, 0, 'search query');
        const query = search.toLowerCase();
        return {
          json: (await listInstruments(search)).filter(instrument =>
            [instrument.ticker, instrument.name, instrument.isin ?? ''].some(field =>
              field.toLowerCase().includes(query)
            )
          ),
        };
      }
      case 'watch-orders':
        return {
          json: await streamEvents(
            broker,
            () => broker.watchOrders(),
            topic => broker.unwatchOrders(topic),
            take,
            write
          ),
        };
    }

    const ticker = argument(args, 0, 'ticker');
    const counter =
      values.counter ??
      /*
       * Only Trading212 needs the lookup: it lists instruments across European venues in their
       * own currencies. Alpaca and IBKR are US equities here, which quote in USD, and `--counter`
       * covers anything that is not.
       */
      (key === 'trading212'
        ? (await listInstruments()).find(instrument => instrument.ticker === ticker)?.currency
        : 'USD');
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
        return {
          json: await placeCliOrder(broker, pair, {
            dryRun: values.dryRun,
            limit: values.limit,
            side: command === 'buy' ? OrderSide.BUY : OrderSide.SELL,
            size: argument(args, 1, 'order size'),
          }),
        };
      }
      case 'cancel':
        if (values.all) {
          return {json: {cancelled: await broker.cancelOpenOrders(pair)}};
        }
        await broker.cancelOrderById(pair, argument(args, 1, 'order id'));
        return {json: {cancelled: [argument(args, 1, 'order id')]}};
      case 'wait':
        return {json: await waitForOrder(broker, pair, argument(args, 1, 'order id'), timeout, poll)};
      case 'smoke': {
        const report = await runSmokeChecks(broker, pair, interval);
        // A failing check has to reach a shell's exit code, or a broken integration reads as a pass.
        return {code: report.ok ? 0 : 1, json: report};
      }
      case 'watch-candles':
        return {
          json: await streamEvents(
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
