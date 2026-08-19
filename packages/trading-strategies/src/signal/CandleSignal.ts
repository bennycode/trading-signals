import type {BatchedCandle} from '@typedtrader/exchange';
import type {SignalDefinition} from './SignalDefinition.js';

export interface CandleSignalOptions {
  id: string;
  intervalInMillis: number;
}

export interface CandleSignalDefinition extends SignalDefinition<BatchedCandle> {
  readonly intervalInMillis: number;
  readonly kind: 'candle';
}

export function candleSignal(options: CandleSignalOptions): CandleSignalDefinition {
  if (!Number.isFinite(options.intervalInMillis) || options.intervalInMillis <= 0) {
    throw new Error('A candle signal interval must be a positive number of milliseconds');
  }
  return Object.freeze({
    id: options.id,
    intervalInMillis: options.intervalInMillis,
    kind: 'candle',
  });
}
