import {describe, expect, it, vi} from 'vitest';
import {CandleBatcher} from '@typedtrader/exchange';
import type {Candle, OneMinuteBatchedCandle} from '@typedtrader/exchange';
import {SignalRuntime, candleSignal, indicatorSignal, sourceSignal, type IncrementalIndicator} from './index.js';

const ONE_MINUTE_IN_MS = 60_000;

function makeCandle(close: number, index: number): OneMinuteBatchedCandle {
  const value = String(close);
  const candle: Candle = {
    base: 'BTC',
    close: value,
    counter: 'USD',
    high: value,
    low: value,
    open: value,
    openTimeInISO: new Date(index * ONE_MINUTE_IN_MS).toISOString(),
    openTimeInMillis: index * ONE_MINUTE_IN_MS,
    sizeInMillis: ONE_MINUTE_IN_MS,
    volume: '1',
  };
  return CandleBatcher.createOneMinuteBatchedCandle([candle]);
}

class RollingMean implements IncrementalIndicator<number, number> {
  readonly #period: number;
  readonly #values: number[] = [];

  constructor(period: number) {
    this.#period = period;
  }

  get isStable() {
    return this.#values.length >= this.#period;
  }

  add(input: number) {
    this.#values.push(input);
    return this.getResult();
  }

  replace(input: number) {
    this.#values[this.#values.length - 1] = input;
    return this.getResult();
  }

  getRequiredInputs() {
    return this.#period;
  }

  getResult() {
    if (!this.isStable) {
      return null;
    }
    const values = this.#values.slice(-this.#period);
    return values.reduce((sum, value) => sum + value, 0) / this.#period;
  }
}

describe('indicatorSignal', () => {
  it('is cold and creates a separate indicator for every runtime session', () => {
    const createIndicator = vi.fn(() => new RollingMean(2));
    const source = sourceSignal<number>({id: 'prices'});
    const mean = indicatorSignal({createIndicator, id: 'mean-2', selectInput: value => value, source});

    expect(createIndicator).not.toHaveBeenCalled();

    new SignalRuntime([mean]);
    new SignalRuntime([mean]);

    expect(createIndicator).toHaveBeenCalledTimes(2);
  });

  it('publishes immutable warming and ready readings for append and replace updates', () => {
    const source = sourceSignal<number>({id: 'prices'});
    const add = vi.fn<(input: number) => number | null>();
    const replace = vi.fn<(input: number) => number | null>();
    const mean = indicatorSignal({
      createIndicator: () => {
        const indicator = new RollingMean(2);
        add.mockImplementation(input => indicator.add(input));
        replace.mockImplementation(input => indicator.replace(input));
        return {
          add,
          getRequiredInputs: () => indicator.getRequiredInputs(),
          getResult: () => indicator.getResult(),
          get isStable() {
            return indicator.isStable;
          },
          replace,
        };
      },
      id: 'mean-2',
      selectInput: value => value,
      source,
    });
    const runtime = new SignalRuntime([mean]);

    expect(runtime.snapshot.get(mean)).toEqual({receivedInputs: 0, requiredInputs: 2, status: 'warming'});

    runtime.update(source, {effectiveAt: 1, kind: 'append', value: 2});
    expect(runtime.snapshot.get(mean)).toEqual({receivedInputs: 1, requiredInputs: 2, status: 'warming'});

    runtime.update(source, {effectiveAt: 2, kind: 'append', value: 4});
    expect(runtime.snapshot.get(mean)).toEqual({effectiveAt: 2, revision: 2, status: 'ready', value: 3});

    runtime.update(source, {effectiveAt: 2, kind: 'replace', value: 6});
    const reading = runtime.snapshot.get(mean);
    expect(reading).toEqual({effectiveAt: 2, revision: 3, status: 'ready', value: 4});
    expect(Object.isFrozen(reading)).toBe(true);
    expect(add).toHaveBeenCalledTimes(2);
    expect(replace).toHaveBeenCalledOnce();
  });

  it('maps structured source values and shares one source across indicators', () => {
    const candles = sourceSignal<{close: number; high: number; low: number}>({id: 'candles'});
    const close = indicatorSignal({
      createIndicator: () => new RollingMean(1),
      id: 'close',
      selectInput: candle => candle.close,
      source: candles,
    });
    const range = indicatorSignal({
      createIndicator: () => {
        let result: number | null = null;
        return {
          add: input => (result = input.high - input.low),
          getRequiredInputs: () => 1,
          getResult: () => result,
          get isStable() {
            return result !== null;
          },
          replace: input => (result = input.high - input.low),
        } satisfies IncrementalIndicator<{high: number; low: number}, number>;
      },
      id: 'range',
      selectInput: candle => ({high: candle.high, low: candle.low}),
      source: candles,
    });
    const runtime = new SignalRuntime([close, range]);

    runtime.update(candles, {
      effectiveAt: 10,
      kind: 'append',
      value: {close: 101, high: 105, low: 99},
    });

    expect(runtime.snapshot.get(close)).toMatchObject({status: 'ready', value: 101});
    expect(runtime.snapshot.get(range)).toMatchObject({status: 'ready', value: 6});
  });

  it('keeps stale and unavailable distinct from warm-up and failure', () => {
    const source = sourceSignal<number>({id: 'prices'});
    const mean = indicatorSignal({
      createIndicator: () => new RollingMean(1),
      id: 'mean',
      selectInput: value => value,
      source,
    });
    const runtime = new SignalRuntime([mean]);

    runtime.update(source, {effectiveAt: 1, kind: 'append', value: 4});
    runtime.setSourceStatus(source, 'stale', 'feed delayed');
    expect(runtime.snapshot.get(mean)).toEqual({lastValue: 4, reason: 'feed delayed', status: 'stale'});

    runtime.setSourceStatus(source, 'unavailable');
    expect(runtime.snapshot.get(mean)).toEqual({lastValue: 4, status: 'unavailable'});
  });

  it('batches a shared candle source once for multiple indicators', () => {
    const bars2m = candleSignal({id: 'bars-2m', intervalInMillis: 2 * ONE_MINUTE_IN_MS});
    const firstAdd = vi.fn<(input: number) => number | null>();
    const secondAdd = vi.fn<(input: number) => number | null>();
    const makeIndicator = (add: typeof firstAdd) => {
      const indicator = new RollingMean(1);
      add.mockImplementation(input => indicator.add(input));
      return {
        add,
        getRequiredInputs: () => indicator.getRequiredInputs(),
        getResult: () => indicator.getResult(),
        get isStable() {
          return indicator.isStable;
        },
        replace: (input: number) => indicator.replace(input),
      };
    };
    const first = indicatorSignal({
      createIndicator: () => makeIndicator(firstAdd),
      id: 'first',
      selectInput: bar => bar.close.toNumber(),
      source: bars2m,
    });
    const second = indicatorSignal({
      createIndicator: () => makeIndicator(secondAdd),
      id: 'second',
      selectInput: bar => bar.close.toNumber(),
      source: bars2m,
    });
    const runtime = new SignalRuntime([first, second]);

    runtime.updateCandle(makeCandle(10, 0));
    expect(firstAdd).not.toHaveBeenCalled();
    expect(secondAdd).not.toHaveBeenCalled();

    runtime.updateCandle(makeCandle(12, 1));
    expect(firstAdd).toHaveBeenCalledExactlyOnceWith(12);
    expect(secondAdd).toHaveBeenCalledExactlyOnceWith(12);
  });
});
