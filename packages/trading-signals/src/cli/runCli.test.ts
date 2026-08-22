import {runCli, USAGE} from './runCli.js';

async function* linesFrom(text: string) {
  for (const line of text.split('\n')) {
    yield line;
  }
}

async function run(argv: string[], input: string = '') {
  const lines: string[] = [];

  await runCli(
    argv,
    () => linesFrom(input),
    line => lines.push(line)
  );

  return lines;
}

describe('runCli', () => {
  it('prints the usage with every available indicator when called without arguments', async () => {
    const lines = await run([]);

    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe(USAGE());
    expect(lines[0]).toContain('sma');
    expect(lines[0]).toContain('atr');
    expect(lines[0]).toContain('stochasticoscillator');
  });

  it('computes a value-series indicator from CSV and passes the time through', async () => {
    const csv = ['time,close', '2026-01-01,10', '2026-01-02,20', '2026-01-03,30'].join('\n');

    const lines = await run(['sma', '2'], csv);

    expect(lines, 'warm-up candles produce no output line').toEqual([
      JSON.stringify({time: '2026-01-02', value: 15}),
      JSON.stringify({time: '2026-01-03', value: 25}),
    ]);
  });

  it('computes a candle-shaped indicator from NDJSON with single-letter field aliases', async () => {
    const candles = [
      '{"h": 105, "l": 95, "c": 100}',
      '{"h": 105, "l": 95, "c": 100}',
      '{"h": 105, "l": 95, "c": 100}',
    ].join('\n');

    const lines = await run(['atr', '2'], candles);

    expect(lines.at(-1)).toBe(JSON.stringify({value: 10}));
  });

  it('accepts a pretty-printed JSON array of candles', async () => {
    const candles = JSON.stringify(
      [
        {close: '10', time: '2026-01-01'},
        {close: '20', time: '2026-01-02'},
        {close: '30', time: '2026-01-03'},
      ],
      null,
      2
    );

    const lines = await run(['sma', '2'], candles);

    expect(lines).toEqual([
      JSON.stringify({time: '2026-01-02', value: 15}),
      JSON.stringify({time: '2026-01-03', value: 25}),
    ]);
  });

  it('collects key=value parameters into a config object for composite indicators', async () => {
    const candle = '{"high": 100, "low": 10, "close": 55}';
    const candles = Array.from({length: 12}, () => candle).join('\n');

    const lines = await run(['stochasticoscillator', 'kPeriod=2', 'dPeriod=2', 'kSlowingPeriod=2'], candles);

    // A close in the middle of a constant range pins every stochastic line at 50.
    expect(lines.at(-1)).toBe(JSON.stringify({value: {stochD: 50, stochJ: 50, stochK: 50}}));
  });

  it('prints only the final value with --last', async () => {
    const csv = ['close', '10', '20', '30'].join('\n');

    const lines = await run(['sma', '2', '--last'], csv);

    expect(lines).toEqual([JSON.stringify({value: 25})]);
  });

  it('prints the usage for the help command', async () => {
    const lines = await run(['help']);

    expect(lines).toEqual([USAGE()]);
  });

  it('feeds high-low indicators from candles without a close', async () => {
    const candles = ['{"high": 12, "low": 8}', '{"high": 14, "low": 9}', '{"high": 16, "low": 11}'].join('\n');

    const lines = await run(['fishertransform', '2', '--last'], candles);

    expect(lines).toEqual([JSON.stringify({value: 0.7913738721291064})]);
  });

  it('feeds volume-aware indicators including single-letter volume aliases', async () => {
    const candle = '{"h": 105, "l": 95, "c": 100, "v": 1000, "o": 98}';
    const candles = Array.from({length: 6}, () => candle).join('\n');

    const mfi = await run(['mfi', '2', '--last'], candles);
    const obv = await run(['obv', '2', '--last'], candles);

    expect(mfi, 'constant money flow reads as a neutral 50').toEqual([JSON.stringify({value: 50})]);
    expect(obv, 'unchanged closes accumulate no volume').toEqual([JSON.stringify({value: 0})]);
  });

  it('feeds open-aware indicators from OHLC candles', async () => {
    const candle = '{"open": 98, "high": 105, "low": 95, "close": 100}';
    const candles = Array.from({length: 6}, () => candle).join('\n');

    const lines = await run(['bop', '2', '--last'], candles);

    // (close 100 - open 98) / (high 105 - low 95) = 0.2 on every candle.
    expect(lines).toEqual([JSON.stringify({value: 0.2})]);
  });

  it('skips blank lines before and between candles', async () => {
    const csv = ['', 'close', '10', '', '20'].join('\n');

    const lines = await run(['sma', '2'], csv);

    expect(lines).toEqual([JSON.stringify({value: 15})]);
  });

  it('passes date and timestamp fields through as the time', async () => {
    const withDate = ['date,close', '2026-01-01,10', '2026-01-02,20'].join('\n');
    const withTimestamp = ['{"timestamp": 1, "close": 10}', '{"timestamp": 2, "close": 20}'].join('\n');

    const dateLines = await run(['sma', '2', '--last'], withDate);
    const timestampLines = await run(['sma', '2'], withTimestamp);

    expect(dateLines).toEqual([JSON.stringify({time: '2026-01-02', value: 15})]);
    expect(timestampLines).toEqual([JSON.stringify({time: '2', value: 15})]);
  });

  it('rejects NDJSON lines that are not candle objects', async () => {
    const candles = ['{"close": 10}', '42'].join('\n');

    await expect(run(['sma', '2'], candles)).rejects.toThrow('Expected candle objects');
  });

  it('rejects JSON arrays whose entries are not candle objects', async () => {
    await expect(run(['sma', '2'], '[1, 2]')).rejects.toThrow('Expected candle objects');
  });

  it('rejects a key=value parameter with a non-numeric value', async () => {
    await expect(run(['sma', 'interval=banana'])).rejects.toThrow('Invalid indicator parameter "interval=banana"');
  });

  it('rejects an unknown indicator with a pointer to the help', async () => {
    await expect(run(['macdx', '12'])).rejects.toThrow('Unknown indicator "macdx"');
  });

  it('does not resolve abstract base classes as indicators', async () => {
    await expect(run(['movingaverage', '2'])).rejects.toThrow('Unknown indicator "movingaverage"');
  });

  it('rejects a non-numeric parameter', async () => {
    await expect(run(['sma', 'banana'])).rejects.toThrow('Invalid indicator parameter "banana"');
  });

  it('names the missing candle field', async () => {
    const csv = ['open', '10'].join('\n');

    await expect(run(['sma', '2'], csv)).rejects.toThrow('missing a numeric "close" field');
  });

  it('fails --last when the input never stabilizes the indicator', async () => {
    const csv = ['close', '10'].join('\n');

    await expect(run(['sma', '5', '--last'], csv)).rejects.toThrow('needs 5 inputs');
  });
});
