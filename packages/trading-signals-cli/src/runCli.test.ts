import {execFile, type ExecFileException} from 'node:child_process';
import {describe, expect, it} from 'vitest';
import {ATR, CG, NVI, RSI, SMA} from 'trading-signals';
import {parseSeries} from './parseSeries.js';
import {runCli} from './runCli.js';

const PRICES = [10, 11, 12, 11, 10, 12, 13, 14, 13, 12, 11, 13, 15, 16, 15, 14, 16, 17, 18, 17, 16, 18];

/** Prices spread into candles, with a volume that falls on every second bar so NVI moves. */
const CANDLES = PRICES.map((close, index) => ({
  close,
  high: close + 1,
  low: close - 1,
  open: index === 0 ? close : PRICES[index - 1],
  volume: 100 + (index % 2) * 50,
}));

function run(args: string[], input: unknown = PRICES) {
  const result = runCli(args, {readInput: () => (typeof input === 'string' ? input : JSON.stringify(input))});
  if ('json' in result) {
    return result.json;
  }
  return result.text;
}

describe('runCli', () => {
  it.each([[], ['help'], ['--help']])('shows help without reading input: %j', (...args) => {
    const result = runCli(args, {
      readInput: () => {
        throw new Error('The input must not be read for help.');
      },
    });
    expect(result).toHaveProperty('text');
    if ('text' in result) {
      expect(result.text).toContain('Usage: trading-signals-cli');
    }
  });

  it('lists the indicators and nothing else the library exports', () => {
    const names = run(['list']);
    expect(typeof names).toBe('string');
    if (typeof names !== 'string') {
      return;
    }
    const listed = names.split('\n');
    // Exact tokens, so that dropping SMA cannot be covered by SMA15 being listed.
    expect(listed).toEqual(expect.arrayContaining(['SMA', 'EMA', 'RSI', 'MACD', 'ATR', 'BollingerBands', 'ZigZag']));
    expect(listed.length, 'the library ships well over a hundred indicators').toBeGreaterThan(100);
    expect(
      listed.filter(name =>
        ['NotEnoughDataError', 'TechnicalIndicator', 'IndicatorSeries', 'getAverage'].includes(name)
      ),
      'errors, base classes and utility functions are exported too, but they are not indicators'
    ).toEqual([]);
  });

  it('narrows the list by a query', () => {
    expect(run(['list', 'stoch'])).toBe('PremierStochastic\nStochasticOscillator\nStochasticRSI');
  });

  it('computes the same value as the library', () => {
    expect(run(['sma', '5'])).toMatchObject({
      indicator: 'SMA',
      input: 'close',
      inputs: PRICES.length,
      required: 5,
      result: new SMA(5).updates(PRICES, false).at(-1),
      stable: true,
    });
  });

  it('reports the trend signal of indicators that have one', () => {
    const rsi = new RSI(14);
    rsi.updates(PRICES, false);
    expect(run(['rsi', '14'])).toMatchObject({result: rsi.getResult(), signal: rsi.getSignal()});
  });

  it('reads whole candles for an indicator that needs them', () => {
    expect(run(['atr', '14'], CANDLES)).toMatchObject({
      input: 'candle',
      result: new ATR(14).updates(CANDLES, false).at(-1),
    });
  });

  it('feeds prices to a price indicator even when the input is candles', () => {
    /*
     * CG divides by the sum of its prices and falls back to zero when that sum is not positive, so a
     * candle reaching it reports a plausible 0 instead of failing. The input flavour has to be
     * settled by what the indicator reads, not by whether a number came out.
     */
    expect(run(['cg', '10', '3'], CANDLES)).toMatchObject({
      input: 'close',
      result: new CG(10, 3).updates(PRICES, false).at(-1),
    });
  });

  it('detects a candle indicator that only reads fields once it has a previous bar', () => {
    expect(run(['nvi'], CANDLES)).toMatchObject({
      input: 'candle',
      result: new NVI().updates(CANDLES, false).at(-1),
    });
  });

  it('feeds the price field that was asked for', () => {
    expect(run(['sma', '5', '--price', 'high'], CANDLES)).toMatchObject({
      input: 'high',
      result: new SMA(5)
        .updates(
          CANDLES.map(candle => candle.high),
          false
        )
        .at(-1),
    });
  });

  it('prints every intermediate result as NDJSON', () => {
    const lines = run(['sma', '5', '--all']);
    expect(typeof lines).toBe('string');
    if (typeof lines === 'string') {
      expect(lines.split('\n')).toHaveLength(PRICES.length);
      expect(lines.split('\n').slice(0, 4), 'null until the interval is filled').toEqual([
        'null',
        'null',
        'null',
        'null',
      ]);
      expect(JSON.parse(lines.split('\n')[4])).toBe(new SMA(5).updates(PRICES, false)[4]);
    }
  });

  it('keeps the last reading of a sparse indicator instead of the last bar', () => {
    const result = run(['swinglow', '{"lookback":2}'], CANDLES);
    expect(result, 'a swing low is emitted at a pivot, not on every bar').toMatchObject({
      input: 'candle',
      stable: true,
    });
  });

  it('reports an indicator that stays silent although the input is long enough', () => {
    /*
     * A config object that is missing a setting cannot be told apart from a complete one, so this
     * is where the silent case survives: without kSlowingPeriod the smoothing never produces a
     * value, and the indicator emits nothing however much data it gets.
     */
    const result = run(['stochasticoscillator', '{"dPeriod":3,"kPeriod":4}'], CANDLES);
    expect(JSON.stringify(result)).toContain('Check the arguments of StochasticOscillator');
  });

  it('leaves out the hint while the indicator is still warming up', () => {
    expect(run(['sma', '50'])).toMatchObject({required: 50, result: null, stable: false});
    expect(run(['sma', '50'])).not.toHaveProperty('hint');
  });

  it('probes at least two bars, so a one-bar series cannot pass a candle indicator off as a price one', () => {
    /*
     * NVI reads no field on the first bar, because there is nothing to compare it to yet, while
     * already emitting the 1000 its index starts at. One probe bar would take that for a price
     * indicator and accept plain numbers.
     */
    expect(() => run(['nvi'], [1])).toThrow('reads candle fields, but the input holds plain prices');
  });

  it('keeps helpers that are not indicators out of the registry', () => {
    expect(() => run(['period', '5'], CANDLES), 'Period tracks a window extreme for other indicators').toThrow(
      'Unknown indicator "period"'
    );
  });

  it('rejects positional arguments for an indicator that takes a config object', () => {
    /*
     * JavaScript boxes the number, the destructuring finds none of its properties and every default
     * applies, so new SuperTrend(14, 5) quietly runs with an interval of 10 and a multiplier of 3.
     */
    expect(() => run(['supertrend', '14', '5'], CANDLES)).toThrow('takes its settings in a config object');
    expect(
      () => run(['supertrend', '{}', '14'], CANDLES),
      'a trailing number is dropped by the destructuring just as silently'
    ).toThrow('takes its settings in a config object');
    expect(
      run(['stochasticoscillator', '{"dPeriod":3,"kPeriod":4,"kSlowingPeriod":2}', '{"overbought":75}'], CANDLES),
      'the optional second config object stays allowed'
    ).toMatchObject({stable: true});
    expect(
      run(['supertrend', '{"interval":14,"multiplier":5}'], CANDLES),
      'the config form sets the interval'
    ).toMatchObject({required: 14});
  });

  it('rejects an infinite result instead of printing it as null', () => {
    // Bollinger Bands Width divides by its middle band, which is zero for these prices.
    expect(() => run(['bollingerbandswidth', 'BollingerBands:3,2'], [-1, 0, 1])).toThrow('infinite value');
  });

  it('does not probe longer than the input, whatever interval was asked for', () => {
    const started = Date.now();
    expect(run(['sma', '1000000000'], [1, 2, 3])).toMatchObject({required: 1_000_000_000, result: null});
    expect(Date.now() - started, 'a billion-bar warm-up must not be probed bar by bar').toBeLessThan(1_000);
  });

  it.each([
    {args: ['nope', '5'], message: 'Unknown indicator "nope"'},
    {args: ['sma', 'abc'], message: 'Cannot read the argument "abc"'},
    {args: ['sma'], message: 'SMA cannot run with []'},
    {args: ['sma', '0'], message: 'they leave it needing "0" inputs'},
    {args: ['atr', '14'], message: 'reads candle fields, but the input holds plain prices'},
    {args: ['sma', '5', '--price', 'volume'], message: 'Not every input carries a "volume" price'},
    {args: ['sma', '5', '--price', 'nope'], message: 'Unknown price field "nope"'},
    {args: ['list', 'nope'], message: 'No indicator matches "nope"'},
  ])('rejects $args', ({args, message}) => {
    expect(() => run(args)).toThrow(message);
  });

  it('rejects an indicator that needs a candle field the input lacks', () => {
    const withoutVolume = CANDLES.map(({close, high, low, open}) => ({close, high, low, open}));
    expect(() => run(['obv', '5'], withoutVolume)).toThrow('does not carry');
  });
});

describe('parseSeries', () => {
  it.each([
    {input: '[1, 2, 3]', name: 'a JSON array'},
    {input: '1 2 3', name: 'whitespace-separated numbers'},
    {input: '1\n2\n3', name: 'one number per line'},
    {input: '{"close":1}\n{"close":2}\n{"close":3}', name: 'newline-delimited JSON'},
    {input: '[{"close":"1"},{"close":"2"},{"close":"3"}]', name: 'string prices, as brokers report them'},
    {input: '"1"\n"2"\n"3"', name: 'newline-delimited string prices, both documented forms at once'},
  ])('reads $name', ({input}) => {
    expect(parseSeries(input).candles).toEqual([{close: 1}, {close: 2}, {close: 3}]);
  });

  it.each([
    {input: '   ', message: 'No input data'},
    {input: 'hello', message: 'Input 1 is not a number'},
    {input: '[{"high":1}]', message: 'has no "close" price'},
    {input: '[{"close":"abc"}]', message: 'is not a number'},
  ])('rejects $input', ({input, message}) => {
    expect(() => parseSeries(input)).toThrow(message);
  });

  it('marks a series of plain numbers as prices only', () => {
    expect(parseSeries('1 2 3').pricesOnly).toBe(true);
    expect(parseSeries('[{"close":1,"high":2}]').pricesOnly).toBe(false);
  });
});

/*
 * These spawn real Node processes. Run them sequentially without blocking the test worker;
 * cold tsx startup can be slow when CI runs all workspace tests at the same time.
 */
describe('trading-signals-cli executable', {concurrent: false, timeout: 15_000}, () => {
  it.each([
    {args: ['--help'], code: 0, input: '', output: 'Usage:'},
    {args: ['list', 'bollinger'], code: 0, input: '', output: 'BollingerBands'},
    {args: ['sma', '3'], code: 0, input: '[1, 2, 3]', output: '"result":2'},
    {args: ['sma', '3'], code: 1, input: 'oops', output: 'is not a number'},
    {args: ['nope'], code: 1, input: '[1]', output: 'Unknown indicator'},
  ])('flushes the correct output stream and exits: $args', async ({args, code, input, output}) => {
    const result = await new Promise<{error: ExecFileException | null; stdout: string; stderr: string}>(resolve => {
      const child = execFile(
        process.execPath,
        ['--import', 'tsx', `${import.meta.dirname}/trading-signals-cli.ts`, ...args],
        {encoding: 'utf8', env: {PATH: process.env.PATH}, timeout: 10_000},
        (error, stdout, stderr) => resolve({error, stderr, stdout})
      );
      child.stdin?.end(input);
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
