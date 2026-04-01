import {z} from 'zod';
import {CandleBatcher, ExchangeOrderSide, ExchangeOrderType} from '@typedtrader/exchange';
import type {ExchangeCandle, OneMinuteBatchedCandle, OrderAdvice, TradingSessionState} from '@typedtrader/exchange';
import {BollingerBands} from 'trading-signals';
import {Strategy} from '../strategy/Strategy.js';

const ONE_HOUR_IN_MS = 3_600_000;
const PERIOD = 20;
const DEVIATION_MULTIPLIER = 2.5;

export const MeanReversionSchema = z.object({});

export type MeanReversionConfig = z.infer<typeof MeanReversionSchema>;

type Phase = 'watching' | 'waitingForRebuy';

type MeanReversionState = {
  phase: Phase;
};

export type CandleFetcher = () => Promise<ExchangeCandle[]>;

export class MeanReversionStrategy extends Strategy {
  static override NAME = '@typedtrader/strategy-mean-reversion';

  readonly #bbands = new BollingerBands(PERIOD, DEVIATION_MULTIPLIER);
  readonly #batcher = new CandleBatcher(ONE_HOUR_IN_MS);
  readonly #fetchCandles?: CandleFetcher;
  #warmedUp = false;

  constructor(options?: {fetchCandles?: CandleFetcher}) {
    super({
      config: {},
      state: {phase: 'watching'},
    });
    this.#fetchCandles = options?.fetchCandles;
  }

  get #state(): MeanReversionState {
    return this.getProxiedState<MeanReversionState>();
  }

  async #warmUp(): Promise<void> {
    this.#warmedUp = true;

    if (!this.#fetchCandles) {
      return;
    }

    const candles = await this.#fetchCandles();
    const hourlyCandles = CandleBatcher.batchMany(candles, ONE_HOUR_IN_MS);

    for (const candle of hourlyCandles) {
      this.#bbands.update(candle.close.toNumber(), false);
    }
  }

  protected override async processCandle(candle: OneMinuteBatchedCandle, _state: TradingSessionState): Promise<OrderAdvice | void> {
    if (!this.#warmedUp) {
      await this.#warmUp();
    }

    const hourlyCandle = this.#batcher.addToBatch(candle);

    if (!hourlyCandle) {
      return;
    }

    const closePrice = hourlyCandle.close.toNumber();
    this.#bbands.update(closePrice, false);

    if (!this.#bbands.isStable) {
      return;
    }

    const {upper, middle} = this.#bbands.getResultOrThrow();

    if (this.#state.phase === 'watching') {
      if (closePrice > upper) {
        this.#state.phase = 'waitingForRebuy';
        return {
          side: ExchangeOrderSide.SELL,
          type: ExchangeOrderType.MARKET,
          amount: null,
          amountIn: 'base',
          reason: `Price ${closePrice.toFixed(2)} broke above upper band ${upper.toFixed(2)}`,
        };
      }
    }

    if (this.#state.phase === 'waitingForRebuy') {
      if (closePrice <= middle) {
        this.#state.phase = 'watching';
        return {
          side: ExchangeOrderSide.BUY,
          type: ExchangeOrderType.MARKET,
          amount: null,
          amountIn: 'counter',
          reason: `Price ${closePrice.toFixed(2)} returned to middle band ${middle.toFixed(2)}`,
        };
      }
    }
  }
}
