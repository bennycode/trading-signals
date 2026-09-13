import {execFile, type ExecFileException} from 'node:child_process';
import {describe, expect, it} from 'vitest';
import {ATR, CG, NVI, RSI, SMA} from 'trading-signals';
import {listIndicators} from './indicators.js';
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

  it('lists every indicator the library exports', () => {
    const names = run(['list']);
    expect(typeof names).toBe('string');
    if (typeof names === 'string') {
      expect(names.split('\n'), 'one name per line, for piping into other tools').toEqual(listIndicators());
      expect(names).toContain('SMA');
      expect(names).toContain('BollingerBands');
    }
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
    const result = run(['zigzag', '5'], CANDLES);
    expect(
      JSON.stringify(result),
      'ZigZag takes {deviation}, so a bare number leaves it without one and it never emits'
    ).toContain('Check the arguments of ZigZag');
  });

  it('leaves out the hint while the indicator is still warming up', () => {
    expect(run(['sma', '50'])).toMatchObject({required: 50, result: null, stable: false});
    expect(run(['sma', '50'])).not.toHaveProperty('hint');
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
