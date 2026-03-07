import type {BatchedCandle, OrderAdvice, TradingSessionState, TradingSessionStrategy} from '@typedtrader/exchange';

export abstract class Strategy implements TradingSessionStrategy {
  static NAME: string;

  latestAdvice: OrderAdvice | undefined = undefined;
  lastBatchedCandle: BatchedCandle | undefined = undefined;
  state: Record<string, unknown> | null = null;

  async onCandle(candle: BatchedCandle, state: TradingSessionState): Promise<OrderAdvice | void> {
    this.lastBatchedCandle = candle;
    const advice = await this.processCandle(candle, state);
    this.latestAdvice = advice ? advice : undefined;
    return advice;
  }

  restoreState(persisted: Record<string, unknown>): void {
    this.state = persisted;
  }

  protected abstract processCandle(candle: BatchedCandle, state: TradingSessionState): Promise<OrderAdvice | void>;
}
