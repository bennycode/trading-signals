import {z} from 'zod';
import type {OneMinuteBatchedCandle, OrderAdvice, TradingSessionState} from '@typedtrader/exchange';
import {Strategy} from '../strategy/Strategy.js';

export const NoopSchema = z.object({}).strict();

export type NoopConfig = z.input<typeof NoopSchema>;

/**
 * Returns no advice on every candle — never places a trade. Useful for
 * smoke-testing the subscription / monitor / scheduling pipeline in isolation
 * from order placement.
 */
export class NoopStrategy extends Strategy {
  static override NAME = '@typedtrader/strategy-noop';

  constructor(_config: NoopConfig = {}) {
    super();
  }

  protected override async processCandle(
    _candle: OneMinuteBatchedCandle,
    _state: TradingSessionState
  ): Promise<OrderAdvice | void> {
    return undefined;
  }
}
