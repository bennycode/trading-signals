import {OrderSide} from '../broker/Broker.js';
import {TradingPair} from '../broker/TradingPair.js';
import {BROKERS, createCliBroker} from './cliBroker.js';
import {placeCliOrder, waitForOrder} from './cliOrders.js';
import {parseCliArgs} from './parseCliArgs.js';
import {streamEvents} from './streamEvents.js';

export interface CliDeps {
  createBroker: typeof createCliBroker;
  env: NodeJS.ProcessEnv;
  writeEvent: (line: string) => void;
}

type CliResult = {text: string} | {json: unknown};

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
          json: await streamEvents(
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
        return {
          json: await placeCliOrder(broker, pair, {
            dryRun: values.dryRun,
            limit: values.limit,
            side: command === 'buy' ? OrderSide.BUY : OrderSide.SELL,
            size: args[1],
          }),
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
