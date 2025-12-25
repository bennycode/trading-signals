import {BatchedCandle} from '@typedtrader/exchange';
import {StrategyAdvice} from './StrategyAdvice.js';

export abstract class Strategy {
  static NAME: string;

  latestAdvice: StrategyAdvice | undefined = undefined;
  lastBatchedCandle: BatchedCandle | undefined = undefined;

  async processBatchedCandle(batchedCandle: BatchedCandle): Promise<StrategyAdvice | void> {
    this.lastBatchedCandle = batchedCandle;
    const advice = await this.processCandle(batchedCandle);
    this.latestAdvice = advice ? advice : undefined;
    return advice;
  }

  protected abstract processCandle(batchedCandle: BatchedCandle): Promise<StrategyAdvice | void>;
}
