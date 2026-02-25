import {z} from 'zod';
import type {OrderBookQuote} from '@typedtrader/exchange';
import type {
  StrategyAdvice,
  StrategyAdviceMarketBuyOrder,
  StrategyAdviceMarketSellOrder,
} from '../strategy/StrategyAdvice.js';
import {StrategySignal} from '../strategy/StrategySignal.js';

export const OrderImbalanceSchema = z.object({
  /** BUY when imbalance >= threshold (e.g. 0.3). */
  imbalanceBuyThreshold: z.number().min(0).max(1),
  /** SELL when imbalance <= threshold (e.g. -0.3). */
  imbalanceSellThreshold: z.number().min(-1).max(0),
  /** Minimum bidSize + askSize to filter low-liquidity noise. */
  minTotalSize: z.number().positive(),
  /** Minimum milliseconds between signals to avoid order spam. */
  cooldownMs: z.number().nonnegative().default(5_000),
  /** Minimum milliseconds before signalling in the opposite direction. Must be >= cooldownMs. */
  flipCooldownMs: z.number().nonnegative().default(60_000),
}).refine(data => data.flipCooldownMs >= data.cooldownMs, {
  message: 'flipCooldownMs must be >= cooldownMs',
  path: ['flipCooldownMs'],
});

export type OrderImbalanceConfig = z.infer<typeof OrderImbalanceSchema>;

export class OrderImbalanceStrategy {
  static readonly NAME = '@typedtrader/strategy-order-imbalance';

  readonly #config: OrderImbalanceConfig;
  #latestAdvice: StrategyAdvice | null = null;
  #lastQuote: OrderBookQuote | null = null;
  #lastSignalAt: number = 0;
  #lastSignalDirection: typeof StrategySignal.BUY_MARKET | typeof StrategySignal.SELL_MARKET | null = null;

  constructor(config: OrderImbalanceConfig) {
    this.#config = config;
  }

  get latestAdvice(): StrategyAdvice | null {
    return this.#latestAdvice;
  }

  get lastQuote(): OrderBookQuote | null {
    return this.#lastQuote;
  }

  processQuote(quote: OrderBookQuote): StrategyAdvice | null {
    this.#lastQuote = quote;

    const totalSize = quote.bidSize + quote.askSize;
    if (totalSize < this.#config.minTotalSize) {
      return null;
    }

    const now = Date.now();
    if (now - this.#lastSignalAt < this.#config.cooldownMs) {
      return null;
    }

    const imbalance = (quote.bidSize - quote.askSize) / totalSize;
    const reason = `Order imbalance ${imbalance.toFixed(4)} (bid ${quote.bidSize} / ask ${quote.askSize})`;

    const isFlip = (signal: typeof StrategySignal.BUY_MARKET | typeof StrategySignal.SELL_MARKET) =>
      this.#lastSignalDirection !== null && this.#lastSignalDirection !== signal;

    if (imbalance >= this.#config.imbalanceBuyThreshold) {
      if (isFlip(StrategySignal.BUY_MARKET) && now - this.#lastSignalAt < this.#config.flipCooldownMs) {
        return null;
      }
      const advice: StrategyAdviceMarketBuyOrder = {
        amount: null,
        amountType: 'counter',
        price: null,
        signal: StrategySignal.BUY_MARKET,
        reason,
      };
      this.#latestAdvice = advice;
      this.#lastSignalAt = now;
      this.#lastSignalDirection = StrategySignal.BUY_MARKET;
      return advice;
    }

    if (imbalance <= this.#config.imbalanceSellThreshold) {
      if (isFlip(StrategySignal.SELL_MARKET) && now - this.#lastSignalAt < this.#config.flipCooldownMs) {
        return null;
      }
      const advice: StrategyAdviceMarketSellOrder = {
        amount: null,
        amountType: 'base',
        price: null,
        signal: StrategySignal.SELL_MARKET,
        reason,
      };
      this.#latestAdvice = advice;
      this.#lastSignalAt = now;
      this.#lastSignalDirection = StrategySignal.SELL_MARKET;
      return advice;
    }

    return null;
  }
}
