import Big from 'big.js';
import {Argument, Command, CommanderError, InvalidArgumentError, Option} from 'commander';
import {parse as parseDuration} from 'ms';
import {BROKERS, type BrokerKey} from './cliBroker.js';

interface Options {
  all?: boolean;
  broker: BrokerKey;
  count?: number;
  counter?: string;
  dryRun?: boolean;
  interval?: number;
  limit?: string;
  live?: boolean;
  poll?: number;
  take?: number;
  timeout?: number;
}

function brokerName(value: string): BrokerKey {
  const key = value.toLowerCase();
  if (key === 'alpaca' || key === 'trading212') {
    return key;
  }
  throw new InvalidArgumentError('Choose alpaca or trading212.');
}

function positiveInt(value: string): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) {
    throw new InvalidArgumentError('Use a positive integer.');
  }
  return number;
}

function positiveDecimal(value: string): string {
  try {
    if (new Big(value).gt(0)) {
      return value;
    }
  } catch {
    // Report the CLI argument rather than big.js internals.
  }
  throw new InvalidArgumentError('Use a positive decimal.');
}

function invocation(command: Command) {
  const values = command.optsWithGlobals<Options>();
  const processedArgs: unknown[] = command.processedArgs;
  const args = processedArgs.filter((arg): arg is string => typeof arg === 'string');
  if (args.some(arg => !arg.trim())) {
    throw new Error('Arguments must not be blank.');
  }
  if (command.name() === 'cancel' && Boolean(values.all) === Boolean(args[1])) {
    throw new Error('Supply exactly one of <orderId> or --all.');
  }
  return {
    args,
    command: command.name(),
    count: values.count ?? 10,
    interval: values.interval ?? parseDuration('1m'),
    key: values.broker,
    poll: values.poll ?? BROKERS[values.broker].pollInterval,
    take: values.take ?? Infinity,
    timeout: values.timeout ?? parseDuration('5m'),
    values,
  };
}

/** Parse one command, or generate its help, before constructing a broker. */
export function parseCliArgs(argv: string[]) {
  let result: ReturnType<typeof invocation> | undefined;
  let help = '';
  const program = new Command('exchange-cli')
    .description('JSON access to trading brokers (paper trading by default).')
    .requiredOption('--broker <name>', 'alpaca or trading212', brokerName)
    .option('--live', 'Use live credentials and trading')
    .option('--counter <currency>', 'Skip currency lookup (Alpaca defaults to USD)')
    .configureHelp({showGlobalOptions: true})
    .configureOutput({
      writeErr: () => {},
      writeOut: text => {
        help += text;
      },
    })
    .addHelpText(
      'after',
      "\nCredentials: <BROKER>_PAPER_API_KEY and <BROKER>_PAPER_API_SECRET; use LIVE with --live.\nSet them in the environment or with Node's --env-file option.\nMarket data requires Alpaca. Results are JSON; failures go to stderr with exit code 1."
    )
    .exitOverride();
  const command = (signature: string, description: string) => {
    const cmd = program.command(signature).description(description);
    cmd.action(() => {
      result = invocation(cmd);
    });
    return cmd;
  };

  command('verify', 'Check credentials');
  command('balances', 'List cash and positions');
  command('instruments <query>', 'Search equities by ticker, name, or ISIN');
  command('quote <ticker>', 'Latest candle close (not a bid/ask quote)');
  command('rules <ticker>', 'Trading rules');
  command('orders <ticker>', 'Open orders');
  command('fills <ticker>', 'Order fills');
  for (const side of ['buy', 'sell']) {
    command(`${side} <ticker>`, 'Place a market or limit order')
      .addArgument(new Argument('<quantity>', 'Positive quantity').argParser(positiveDecimal))
      .option('--limit <price>', 'Limit price', positiveDecimal)
      .option('--dry-run', 'Check trading rules and estimate fees');
  }
  command('wait <ticker> <orderId>', 'Wait for a fill or for the order to close')
    .addOption(
      new Option('--timeout <duration>', 'Wait deadline; does not cancel the order')
        .argParser(parseDuration)
        .default(parseDuration('5m'), '5m')
    )
    .option('--poll <duration>', 'Poll interval (default: broker rate limit)', parseDuration);
  command('cancel <ticker> [orderId]', 'Cancel one order, or all with --all').option(
    '--all',
    'Cancel every open order for the ticker'
  );
  command('candles <ticker>', 'Recent candles')
    .addOption(
      new Option('--interval <duration>', 'Candle interval').argParser(parseDuration).default(parseDuration('1m'), '1m')
    )
    .option('--count <n>', 'Number of candles', positiveInt, 10);
  command('watch-candles <ticker>', 'Stream candles as NDJSON')
    .addOption(
      new Option('--interval <duration>', 'Candle interval').argParser(parseDuration).default(parseDuration('1m'), '1m')
    )
    .option('--take <n>', 'Stop after n events (default: until Ctrl-C)', positiveInt);
  command('watch-orders', 'Stream fills as NDJSON').option(
    '--take <n>',
    'Stop after n events (default: until Ctrl-C)',
    positiveInt
  );
  command('time', 'Broker time');

  try {
    program.parse(argv.length ? argv : ['--help'], {from: 'user'});
  } catch (error) {
    if (!(error instanceof CommanderError) || error.exitCode !== 0) {
      throw error;
    }
  }
  return result ?? {help};
}
