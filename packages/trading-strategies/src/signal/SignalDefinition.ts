declare const signalValue: unique symbol;

export interface SignalDefinition<Value> {
  readonly id: string;
  readonly kind: 'source' | 'candle' | 'indicator';
  readonly [signalValue]?: Value;
}

export interface SourceSignalOptions {
  id: string;
}

export interface SourceSignalDefinition<Value> extends SignalDefinition<Value> {
  readonly kind: 'source';
}

export function sourceSignal<Value>(options: SourceSignalOptions): SourceSignalDefinition<Value> {
  return Object.freeze({id: options.id, kind: 'source'});
}

export interface IncrementalIndicator<Input, Result> {
  readonly isStable: boolean;

  add(input: Input): Result | null;
  replace(input: Input): Result | null;
  getRequiredInputs(): number;
  getResult(): Result | null;
}

export interface IndicatorSignalOptions<SourceValue, Input, Result> {
  createIndicator(): IncrementalIndicator<Input, Result>;
  id: string;
  selectInput(value: SourceValue): Input;
  source: SignalDefinition<SourceValue>;
}

export interface IndicatorSignalDefinition<SourceValue, Input, Result> extends SignalDefinition<Result> {
  readonly createIndicator: () => IncrementalIndicator<Input, Result>;
  readonly kind: 'indicator';
  readonly selectInput: (value: SourceValue) => Input;
  readonly source: SignalDefinition<SourceValue>;
}

export function indicatorSignal<SourceValue, Input, Result>(
  options: IndicatorSignalOptions<SourceValue, Input, Result>
): IndicatorSignalDefinition<SourceValue, Input, Result> {
  return Object.freeze({
    createIndicator: options.createIndicator,
    id: options.id,
    kind: 'indicator',
    selectInput: options.selectInput,
    source: options.source,
  });
}

export type SignalReading<Value> =
  | Readonly<{
      receivedInputs: number;
      requiredInputs: number;
      status: 'warming';
    }>
  | Readonly<{
      effectiveAt: number;
      revision: number;
      status: 'ready';
      value: Value;
    }>
  | Readonly<{
      lastValue?: Value;
      reason?: string;
      status: 'stale' | 'unavailable' | 'error';
    }>;

export interface SignalUpdate<Value> {
  effectiveAt: number;
  kind: 'append' | 'replace';
  value: Value;
}
