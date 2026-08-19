import {CandleBatcher} from '@typedtrader/exchange';
import type {OneMinuteBatchedCandle} from '@typedtrader/exchange';
import type {CandleSignalDefinition} from './CandleSignal.js';
import type {
  IncrementalIndicator,
  IndicatorSignalDefinition,
  SignalDefinition,
  SignalReading,
  SignalUpdate,
} from './SignalDefinition.js';

type UnknownSignal = SignalDefinition<unknown>;
type UnknownIndicatorDefinition = IndicatorSignalDefinition<unknown, unknown, unknown>;

interface IndicatorState {
  definition: UnknownIndicatorDefinition;
  indicator: IncrementalIndicator<unknown, unknown>;
  lastValue?: unknown;
  reading: SignalReading<unknown>;
  receivedInputs: number;
  revision: number;
}

export class SignalSnapshot {
  readonly #readings: ReadonlyMap<UnknownSignal, SignalReading<unknown>>;

  constructor(readings: ReadonlyMap<UnknownSignal, SignalReading<unknown>>) {
    this.#readings = readings;
    Object.freeze(this);
  }

  get<Value>(definition: SignalDefinition<Value>): SignalReading<Value> {
    const reading = this.#readings.get(definition);
    if (!reading) {
      throw new Error(`Signal "${definition.id}" is not loaded in this runtime`);
    }
    return reading as SignalReading<Value>;
  }
}

export class SignalRuntime {
  readonly #candleBatchers = new Map<CandleSignalDefinition, CandleBatcher>();
  readonly #consumers = new Map<UnknownSignal, IndicatorState[]>();
  readonly #ids = new Map<string, UnknownSignal>();
  readonly #states = new Map<UnknownSignal, IndicatorState>();
  #snapshot = new SignalSnapshot(new Map());

  constructor(definitions: readonly UnknownSignal[]) {
    for (const definition of definitions) {
      this.#load(definition);
    }
    this.#publish();
  }

  get snapshot() {
    return this.#snapshot;
  }

  update<Value>(source: SignalDefinition<Value>, update: SignalUpdate<Value>): SignalSnapshot {
    const consumers = this.#consumers.get(source);
    if (!consumers) {
      throw new Error(`Signal source "${source.id}" is not loaded in this runtime`);
    }

    this.#updateConsumers(consumers, update);
    this.#publish();
    return this.#snapshot;
  }

  updateCandle(candle: OneMinuteBatchedCandle): SignalSnapshot {
    for (const [source, batcher] of this.#candleBatchers) {
      const batched = batcher.addToBatch(candle);
      if (!batched) {
        continue;
      }
      const consumers = this.#consumers.get(source) ?? [];
      this.#updateConsumers(consumers, {
        effectiveAt: batched.openTimeInMillis + batched.sizeInMillis,
        kind: 'append',
        value: batched,
      });
    }
    this.#publish();
    return this.#snapshot;
  }

  setSourceStatus<Value>(
    source: SignalDefinition<Value>,
    status: 'stale' | 'unavailable',
    reason?: string
  ): SignalSnapshot {
    const consumers = this.#consumers.get(source);
    if (!consumers) {
      throw new Error(`Signal source "${source.id}" is not loaded in this runtime`);
    }
    this.#setConsumerStatus(consumers, status, reason);
    this.#publish();
    return this.#snapshot;
  }

  #load(definition: UnknownSignal): void {
    const existing = this.#ids.get(definition.id);
    if (existing && existing !== definition) {
      throw new Error(`Signal id "${definition.id}" is already loaded by another definition`);
    }
    this.#ids.set(definition.id, definition);

    if (definition.kind === 'candle' && !this.#candleBatchers.has(definition as CandleSignalDefinition)) {
      const candleDefinition = definition as CandleSignalDefinition;
      this.#candleBatchers.set(candleDefinition, new CandleBatcher(candleDefinition.intervalInMillis));
    }

    if (definition.kind !== 'indicator' || this.#states.has(definition)) {
      return;
    }

    const indicatorDefinition = definition as unknown as UnknownIndicatorDefinition;
    this.#load(indicatorDefinition.source);
    const indicator = indicatorDefinition.createIndicator();
    const state: IndicatorState = {
      definition: indicatorDefinition,
      indicator,
      reading: Object.freeze({
        receivedInputs: 0,
        requiredInputs: indicator.getRequiredInputs(),
        status: 'warming',
      }),
      receivedInputs: 0,
      revision: 0,
    };
    this.#states.set(definition, state);

    const consumers = this.#consumers.get(indicatorDefinition.source) ?? [];
    consumers.push(state);
    this.#consumers.set(indicatorDefinition.source, consumers);
  }

  #updateConsumers(consumers: readonly IndicatorState[], update: SignalUpdate<unknown>): void {
    for (const state of consumers) {
      const output = this.#updateIndicator(state, update);
      if (output) {
        this.#updateConsumers(this.#consumers.get(state.definition) ?? [], output);
      }
    }
  }

  #setConsumerStatus(consumers: readonly IndicatorState[], status: 'stale' | 'unavailable', reason?: string): void {
    for (const state of consumers) {
      state.reading = Object.freeze({
        ...(state.lastValue === undefined ? {} : {lastValue: state.lastValue}),
        ...(reason === undefined ? {} : {reason}),
        status,
      });
      this.#setConsumerStatus(this.#consumers.get(state.definition) ?? [], status, reason);
    }
  }

  #updateIndicator(state: IndicatorState, update: SignalUpdate<unknown>): SignalUpdate<unknown> | undefined {
    try {
      const input = state.definition.selectInput(update.value);
      if (update.kind === 'append') {
        state.indicator.add(input);
        state.receivedInputs += 1;
      } else {
        state.indicator.replace(input);
      }
      state.revision += 1;

      const value = state.indicator.getResult();
      if (state.indicator.isStable && value !== null) {
        state.lastValue = value;
        state.reading = Object.freeze({
          effectiveAt: update.effectiveAt,
          revision: state.revision,
          status: 'ready',
          value,
        });
        return {
          effectiveAt: update.effectiveAt,
          kind: update.kind,
          value,
        };
      }
      state.reading = Object.freeze({
        receivedInputs: state.receivedInputs,
        requiredInputs: state.indicator.getRequiredInputs(),
        status: 'warming',
      });
    } catch (error) {
      state.reading = Object.freeze({
        ...(state.lastValue === undefined ? {} : {lastValue: state.lastValue}),
        reason: error instanceof Error ? error.message : String(error),
        status: 'error',
      });
    }
    return undefined;
  }

  #publish(): void {
    const readings = new Map<UnknownSignal, SignalReading<unknown>>();
    for (const [definition, state] of this.#states) {
      readings.set(definition, state.reading);
    }
    this.#snapshot = new SignalSnapshot(readings);
  }
}
