import {execFile, type ExecFileException} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {ATR, CG, IndicatorInputShape, NVI, RSI, SMA, VROC} from 'trading-signals';
import {parseSeries} from './parseSeries.js';
import {runIndicator} from './runIndicator.js';
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

/**
 * Every indicator the CLI exposes, spelled out so that an indicator disappearing from the registry
 * fails here instead of going unnoticed. A new indicator in the library is meant to show up in this
 * list: add it, that is the promise the command makes.
 */
const ALL_INDICATORS = [
  'AC',
  'AD',
  'ADOSC',
  'ADX',
  'ADXR',
  'ALMA',
  'AO',
  'APO',
  'ATR',
  'AccelerationBands',
  'AccumulativeSwingIndex',
  'Alligator',
  'Aroon',
  'BOP',
  'BollingerBands',
  'BollingerBandsWidth',
  'BreakoutBarLow',
  'CCI',
  'CFO',
  'CG',
  'CHOP',
  'CMF',
  'CMO',
  'CVI',
  'ChandeKrollStop',
  'ChandelierExit',
  'ConnorsRSI',
  'CoppockCurve',
  'DEMA',
  'DMA',
  'DPO',
  'DX',
  'DeMarker',
  'DerivativeOscillator',
  'DisparityIndex',
  'DonchianChannels',
  'EMA',
  'EMV',
  'ER',
  'ElderRay',
  'FRAMA',
  'FisherTransform',
  'ForceIndex',
  'GAPO',
  'GannHiLo',
  'GatorOscillator',
  'HMA',
  'HTTrendline',
  'HigherLowTrail',
  'IBS',
  'IMI',
  'IQR',
  'IchimokuCloud',
  'KAMA',
  'KST',
  'KVO',
  'KeltnerChannels',
  'LaguerreRSI',
  'LinearRegression',
  'MACD',
  'MAD',
  'MAMA',
  'MFI',
  'MOM',
  'MarketFacilitationIndex',
  'MassIndex',
  'McGinleyDynamic',
  'NATR',
  'NVI',
  'OBV',
  'PGO',
  'PMO',
  'PPO',
  'PSAR',
  'PSL',
  'PVI',
  'PVO',
  'PVT',
  'PercentB',
  'PremierStochastic',
  'ProjectionOscillator',
  'QQE',
  'Qstick',
  'RCI',
  'REI',
  'RMA',
  'RMI',
  'ROC',
  'RSI',
  'RVOL',
  'RandomWalkIndex',
  'RelativeVigorIndex',
  'RelativeVolatilityIndex',
  'RogersSatchellVolatility',
  'SMA',
  'SMA15',
  'SMI',
  'STC',
  'StochasticOscillator',
  'StochasticRSI',
  'SuperSmoother',
  'SuperTrend',
  'SwingHigh',
  'SwingIndex',
  'SwingLow',
  'T3',
  'TDS',
  'TEMA',
  'TR',
  'TRIMA',
  'TRIX',
  'TSI',
  'TTMSqueeze',
  'UlcerIndex',
  'UltimateOscillator',
  'VHF',
  'VIDYA',
  'VROC',
  'VWAP',
  'VWMA',
  'VolatilityStop',
  'VortexIndicator',
  'WAD',
  'WMA',
  'WSMA',
  'WaddahAttarExplosion',
  'WaveTrend',
  'WilliamsR',
  'ZLEMA',
  'ZigZag',
] as const;

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

  it('lists every indicator and nothing else the library exports', () => {
    const names = run(['list']);
    expect(typeof names).toBe('string');
    if (typeof names !== 'string') {
      return;
    }
    expect(
      names.split('\n'),
      'the list is the promise that every indicator of the library is reachable from the command line'
    ).toEqual([...ALL_INDICATORS]);
    expect(
      ALL_INDICATORS.filter(name =>
        ['NotEnoughDataError', 'TechnicalIndicator', 'IndicatorSeries', 'Period', 'getAverage'].includes(name)
      ),
      'errors, base classes and helpers are exported too, but they are not indicators'
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

  it('feeds volumes to a volume series, which no amount of probing could tell from a price series', () => {
    const volumes = CANDLES.map(candle => candle.volume);
    expect(
      run(['vroc', '10'], CANDLES),
      'Volume Rate of Change over closing prices reads like a perfectly ordinary result, which is why the library declares the difference'
    ).toMatchObject({input: 'volume', result: new VROC(10).updates(volumes, false).at(-1)});
  });

  it('feeds prices to a price indicator even when the input is candles', () => {
    expect(
      run(['cg', '10', '3'], CANDLES),
      'CG falls back to zero when the sum of its prices is not positive, so a candle reaching it reports a plausible 0 rather than failing'
    ).toMatchObject({
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
    const result = run(['stochasticoscillator', '{"dPeriod":3,"kPeriod":4}'], CANDLES);
    expect(
      JSON.stringify(result),
      'an incomplete config cannot be told apart from a complete one, so without kSlowingPeriod the smoothing never produces a value however much data arrives'
    ).toContain('one of its settings is missing');
  });

  it('names the harmless cause of an empty reading as well', () => {
    const rising = PRICES.map((_, index) => ({close: 100 + index, high: 101 + index, low: 99 + index}));
    const result = run(['swinglow', '{"lookback":3}'], rising);
    expect(
      JSON.stringify(result),
      'a strictly rising series holds no swing low, so the arguments are not what is wrong here'
    ).toContain('emits only at an event this input does not contain');
  });

  it('leaves out the hint while the indicator is still warming up', () => {
    expect(run(['sma', '50'])).toMatchObject({required: 50, result: null, stable: false});
    expect(run(['sma', '50'])).not.toHaveProperty('hint');
  });

  it('probes at least two bars, so a one-bar series cannot pass a candle indicator off as a price one', () => {
    expect(
      () => run(['nvi'], [1]),
      'NVI reads no field on the first bar yet already emits the 1000 its index starts at, which one probe bar would take for a price indicator'
    ).toThrow('reads candle fields');
  });

  it('rejects candles that lack a field the indicator reaches for', () => {
    const withoutVolume = CANDLES.map(({close, high, low, open}) => ({close, high, low, open}));
    expect(
      () => run(['nvi'], withoutVolume),
      'a missing field arrives as undefined, and comparing against it is merely false: NVI would keep and report its initial index'
    ).toThrow('reads "volume", which input 1 does not carry');
  });

  it('keeps helpers that are not indicators out of the registry', () => {
    expect(() => run(['period', '5'], CANDLES), 'Period tracks a window extreme for other indicators').toThrow(
      'Unknown indicator "period"'
    );
  });

  it('rejects positional arguments for an indicator that takes a config object', () => {
    expect(
      () => run(['supertrend', '14', '5'], CANDLES),
      'the boxed number carries none of the properties, so every default would apply and 14 and 5 would be lost'
    ).toThrow('It expects one config object, for example {"interval":…, "multiplier":…}');
    expect(
      () => run(['supertrend', '{}', '14'], CANDLES),
      'a trailing number is dropped by the destructuring just as silently'
    ).toThrow('SuperTrend takes 1 argument');
    expect(
      () => run(['supertrend', '[]'], CANDLES),
      'an array is an object to typeof but carries no settings either'
    ).toThrow('takes its settings in a config object');
    expect(
      () => run(['atr', '14', '{}'], CANDLES),
      'a bare object in a position the constructor never reads is lost, even within the arguments it declares'
    ).toThrow('never reads the argument in position 2');
    expect(
      () => run(['cci', '20', '1'], CANDLES),
      'CCI takes a positional interval and its thresholds in a config object, so the position decides'
    ).toThrow('expects a config object in position 2');
    expect(
      () => run(['supertrend', '{"interval":14}', '{"multiplier":5}'], CANDLES),
      'a second object is dropped by a constructor that reads only one'
    ).toThrow('SuperTrend takes 1 argument');
    expect(
      run(['stochasticoscillator', '{"dPeriod":3,"kPeriod":4,"kSlowingPeriod":2}', '{"overbought":75}'], CANDLES),
      'the optional second config object stays allowed, because the constructor reads that position too'
    ).toMatchObject({stable: true});
    expect(
      run(['cci', '20', '{"overbought":130,"oversold":-130}'], CANDLES),
      'a reading of 124 is bullish against the default band of 100 and neutral against the one asked for, so the signal proves the thresholds arrived'
    ).toMatchObject({signal: {state: 'SIDEWAYS'}});
    expect(run(['cci', '20'], CANDLES), 'the same reading against the default band').toMatchObject({
      signal: {state: 'BULLISH'},
    });
    expect(
      run(['supertrend', '{"interval":14,"multiplier":5}'], CANDLES),
      'the config form sets the interval'
    ).toMatchObject({required: 14});
  });

  it('rejects an argument beyond the ones the constructor declares', () => {
    expect(
      () => run(['sma', '5', '999'], PRICES),
      'a number consumed by assignment leaves no trace, so the parameter list is where the excess shows up'
    ).toThrow('SMA takes 1 argument, so "999" would be ignored');
    expect(() => run(['vwap', '{"interval":14}'], CANDLES), 'VWAP declares no parameters at all').toThrow(
      'VWAP takes no arguments'
    );
  });

  it('reads the real bars, so a field behind a branch of the data is still seen', () => {
    const risingWithoutLow = PRICES.map((_, index) => ({close: 100 + index, high: 100 + index, open: 100 + index}));
    expect(
      () => run(['breakoutbarlow', '{"lookback":3}'], risingWithoutLow),
      'a breakout reaches for the low of the bar that broke out, which one repeated candle never does'
    ).toThrow('reads "low", which input 1 does not carry');
  });

  it('names the missing field when candles carry fewer than an indicator reads', () => {
    const closesOnly = PRICES.map(close => ({close}));
    expect(
      () => run(['tr', ...[]], closesOnly),
      'a candle carrying only a close is still a candle, so the field is what is missing, not the shape'
    ).toThrow('reads "high", which input 1 does not carry');
    expect(() => run(['tr'], PRICES), 'plain numbers are the case where the shape is wrong').toThrow(
      'the input holds plain prices'
    );
  });

  it('rejects a misspelled setting inside a nested config', () => {
    expect(
      () => run(['rmi', '{"signalThresholds":{"overbougt":80}}'], PRICES),
      'a nested destructuring drops an unknown key as quietly as a top-level one'
    ).toThrow('RMI\'s "signalThresholds" does not read "overbougt"');
    expect(
      run(['rmi', '{"signalThresholds":{"overbought":99,"oversold":1}}'], PRICES),
      'a reading of 97 is bullish against the default band and neutral against the one passed in, so the signal proves the nested settings arrived'
    ).toMatchObject({signal: {state: 'SIDEWAYS'}});
    expect(run(['rmi'], PRICES), 'the same reading against the default band').toMatchObject({
      signal: {state: 'BULLISH'},
    });
    expect(
      () => run(['rmi', '{"signalThresholds":5}'], PRICES),
      'a number where a nested config belongs is boxed and ignored, like a whole config would be'
    ).toThrow('RMI\'s "signalThresholds" takes its settings in a config object');
  });

  it('rejects a config key the constructor does not read', () => {
    expect(
      () => run(['supertrend', '{"intervall":14,"multiplier":5}'], CANDLES),
      'a misspelled key is dropped by the destructuring and leaves the default interval of 10 in place'
    ).toThrow('does not read "intervall"');
  });

  it('accepts a reading the indicator recovered from an infinite intermediate one', () => {
    expect(
      run(['bollingerbandswidth', 'BollingerBands:3,2'], [-1, 0, 1, 1]),
      'the width divides by a middle band that is zero for the first window of this series and positive for the last, and only the reported reading has to hold up'
    ).toMatchObject({stable: true});
    expect(
      () => run(['bollingerbandswidth', 'BollingerBands:3,2', '--all'], [-1, 0, 1, 1]),
      'every reading is printed with --all, so every reading has to survive JSON'
    ).toThrow('infinite value');
  });

  it('gives a failure raised while reading the input its context back', () => {
    expect(
      () => run(['stochasticrsi', '10', 'SMA', '5'], PRICES),
      'StochasticRSI keeps its pair of smoothing averages untouched until a bar arrives, so a wrong shape passes every check and breaks on the first update'
    ).toThrow('The indicator failed on the input');
    expect(run(['stochasticrsi', '10'], PRICES), 'the forms the command can express still work').toMatchObject({
      stable: true,
    });
  });

  it('rejects an infinite result instead of printing it as null', () => {
    expect(
      () => run(['bollingerbandswidth', 'BollingerBands:3,2'], [-1, 0, 1]),
      'the width divides by a middle band that is zero for these prices'
    ).toThrow('infinite value');
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
    {args: ['atr', '14'], message: 'reads candle fields (high, low, close), but the input holds plain prices'},
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

describe('runIndicator', () => {
  /** A price indicator whose reading is whatever it is handed, to reach results the library will not produce. */
  const fake = (result: unknown) => () => ({
    getRequiredInputs: () => 1,
    getResult: () => result,
    inputShape: IndicatorInputShape.VALUE,
    update: () => result,
  });

  it.each([
    {name: 'a bare NaN', result: Number.NaN},
    {name: 'a NaN inside a composite result', result: {histogram: 1, macd: Number.NaN}},
    {name: 'a NaN nested deeper', result: {bands: {lower: Number.NaN, upper: 2}}},
  ])('rejects $name', ({result}) => {
    expect(
      () => runIndicator(fake(result), parseSeries('1 2 3'), 'close'),
      'JSON.stringify turns NaN into null, which would pair an empty result with stable: true'
    ).toThrow('computed no number');
  });

  it('rejects an infinite value wherever it sits in the result', () => {
    expect(() => runIndicator(fake({width: Number.POSITIVE_INFINITY}), parseSeries('1 2 3'), 'close')).toThrow(
      'infinite value'
    );
  });

  it('passes a finite composite result through', () => {
    expect(runIndicator(fake({lower: 1, upper: 2}), parseSeries('1 2 3'), 'close')).toMatchObject({
      input: 'close',
      required: 1,
    });
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
    {input: '[""]', message: 'is not a number'},
    {input: '[{"close":"  "}]', message: 'is not a number'},
  ])('rejects $input', ({input, message}) => {
    expect(() => parseSeries(input)).toThrow(message);
  });

  it('marks a series of plain numbers as prices only', () => {
    expect(parseSeries('1 2 3').pricesOnly).toBe(true);
    expect(parseSeries('[{"close":1,"high":2}]').pricesOnly).toBe(false);
    expect(
      parseSeries('[{"close":1}]').pricesOnly,
      'a candle that carries only a close was still written as a candle'
    ).toBe(false);
  });
});

/** Reading a file instead of stdin happens only in the executable, where no reader is injected. */
const INPUT_FILE = join(tmpdir(), 'trading-signals-cli-input.json');
writeFileSync(INPUT_FILE, JSON.stringify([10, 20, 30]));

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
    {args: ['sma', '3', '--input', INPUT_FILE], code: 0, input: '', output: '"result":20'},
    {args: ['sma', '3', '--input', `${INPUT_FILE}.missing`], code: 1, input: '', output: 'ENOENT'},
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
