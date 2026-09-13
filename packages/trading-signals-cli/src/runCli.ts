import {readFileSync} from 'node:fs';
import {parseArgs} from 'node:util';
import {createIndicator, listIndicators} from './indicators.js';
import {PRICE_FIELDS, parseSeries, type PriceField} from './parseSeries.js';
import {runIndicator} from './runIndicator.js';

export interface CliDeps {
  readInput: (file?: string) => string;
}

type CliResult = {text: string} | {json: unknown};

const HELP = `Usage: trading-signals-cli <indicator> [arguments...] [options]

Runs a technical indicator from the trading-signals package over candles or prices and prints the
result as JSON. Input arrives on stdin or through --input: a JSON array, newline-delimited JSON, or
whitespace-separated numbers. Candle objects need a close price; string prices are read as numbers.

Commands:
  <indicator> [arguments...]  Run an indicator, for example sma 20 or bollingerbands 20 2
  list [query]                List the available indicators, optionally matching a query
  help                        Show this help

Options:
  --input <file>              Read the input from a file instead of stdin
  --price <field>             Price to feed price-based indicators (${PRICE_FIELDS.join(', ')}; default: close)
  --all                       Print every intermediate result as NDJSON instead of the last one
  -h, --help                  Show this help

Indicator arguments are read as JSON, so numbers and objects both work. An argument that names
another indicator passes that class (atr 14 SMA), and NAME:ARGS passes an instance of it
(macd EMA:12 EMA:26 EMA:9).

Examples:
  echo '[1, 2, 3, 4, 5]' | trading-signals-cli sma 3
  exchange-cli candles AAPL --broker alpaca --count 50 | trading-signals-cli rsi 14
  trading-signals-cli atr 14 --input candles.json
  trading-signals-cli ichimokucloud '{"conversionInterval":9}' --input candles.json
  trading-signals-cli list stoch`;

function parsePriceField(value: string): PriceField {
  const field = PRICE_FIELDS.find(candidate => candidate === value);
  if (!field) {
    throw new Error(`Unknown price field "${value}". Use one of: ${PRICE_FIELDS.join(', ')}.`);
  }
  return field;
}

/** Reads the whole input at once: an indicator needs its warm-up bars before it says anything. */
function readInput(file?: string): string {
  if (file) {
    return readFileSync(file, 'utf8');
  }
  if (process.stdin.isTTY) {
    throw new Error('No input data. Pipe candles or prices into the command, or pass --input <file>.');
  }
  return readFileSync(0, 'utf8');
}

export function runCli(argv: string[], overrides: Partial<CliDeps> = {}): CliResult {
  const {positionals, values} = parseArgs({
    allowPositionals: true,
    args: argv,
    options: {
      all: {default: false, type: 'boolean'},
      help: {default: false, short: 'h', type: 'boolean'},
      input: {type: 'string'},
      price: {default: 'close', type: 'string'},
    },
    strict: true,
  });

  const [command = 'help', ...args] = positionals;
  if (values.help || command === 'help') {
    return {text: HELP};
  }
  if (command === 'list') {
    const names = listIndicators(args[0]);
    if (names.length === 0) {
      throw new Error(`No indicator matches "${args[0]}".`);
    }
    return {text: names.join('\n')};
  }

  const {create, name} = createIndicator(command, args);
  const series = parseSeries((overrides.readInput ?? readInput)(values.input));
  const {indicator, input, required, results} = runIndicator(create, series, parsePriceField(values.price));

  if (values.all) {
    return {text: results.map(result => JSON.stringify(result ?? null)).join('\n')};
  }

  /*
   * The indicator's own result rather than the last update: sparse indicators (swing points,
   * breakouts) return null on a bar that emits nothing while still holding their last reading.
   */
  const result = indicator.getResult() ?? null;
  const signal = indicator.getSignal?.();
  /*
   * An indicator reads settings it was not given as undefined and then silently never emits, which
   * is indistinguishable from a warm-up on the result alone. Having more inputs than the warm-up
   * needs and still no result is the observable symptom, so it is reported next to the empty result.
   */
  const hint =
    result === null && series.candles.length >= required
      ? `No result from ${series.candles.length} inputs although ${required} would be enough. Check the arguments of ${name}: some indicators take a config object, as in zigzag '{"deviation":5}'.`
      : undefined;
  return {
    json: {
      indicator: name,
      input,
      inputs: series.candles.length,
      required,
      result,
      stable: result !== null,
      ...(hint === undefined ? {} : {hint}),
      ...(signal === undefined ? {} : {signal}),
    },
  };
}
