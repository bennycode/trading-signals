import {z} from 'zod';
import type {OneMinuteBatchedCandle, OrderAdvice, TradingSessionState} from '@typedtrader/exchange';
import {ProtectedStrategy, ProtectedStrategySchema} from '../strategy-protected/ProtectedStrategy.js';

export const ProtectionOnlySchema = ProtectedStrategySchema.extend({});
export type ProtectionOnlyConfig = z.input<typeof ProtectionOnlySchema>;

/**
 * A no-op strategy that never opens a position on its own. Use it with
 * `seedFromBalance: true` to attach stop-loss / take-profit guards to an
 * existing position that was opened manually or by another strategy.
 */
export class ProtectionOnlyStrategy extends ProtectedStrategy {
  static override NAME = '@typedtrader/strategy-protection-only';

  constructor(config: ProtectionOnlyConfig = {}) {
    super({config});
  }

  protected override async processCandle(
    candle: OneMinuteBatchedCandle,
    state: TradingSessionState
  ): Promise<OrderAdvice | void> {
    return super.processCandle(candle, state);
  }
}
