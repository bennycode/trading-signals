import {z} from 'zod';
import {ExchangeOrderSide, ExchangeOrderType} from '@typedtrader/exchange';
import type {OneMinuteBatchedCandle, OrderAdvice, TradingSessionState} from '@typedtrader/exchange';
import {BollingerBands, EMA, MACD, RSI} from 'trading-signals';
import {Strategy} from '../strategy/Strategy.js';

export const MultiIndicatorConfluenceSchema = z
  .object({
    /** EMA short period for trend detection. */
    emaShortPeriod: z.number().int().positive(),
    /** EMA long period for trend detection. */
    emaLongPeriod: z.number().int().positive(),
    /** MACD short EMA period. */
    macdShortPeriod: z.number().int().positive(),
    /** MACD long EMA period. */
    macdLongPeriod: z.number().int().positive(),
    /** MACD signal EMA period. */
    macdSignalPeriod: z.number().int().positive(),
    /** Bollinger Bands period. */
    bollingerPeriod: z.number().int().positive(),
    /** Bollinger Bands standard deviation multiplier. */
    bollingerDeviationMultiplier: z.number().positive(),
    /** RSI period. */
    rsiPeriod: z.number().int().positive(),
    /** RSI overbought threshold (veto BUY above this). */
    rsiOverbought: z.number().positive().max(100),
    /** RSI oversold threshold (veto SELL below this). */
    rsiOversold: z.number().positive().max(100),
  })
  .refine(data => data.emaShortPeriod < data.emaLongPeriod, {
    message: 'emaShortPeriod must be less than emaLongPeriod',
    path: ['emaShortPeriod'],
  })
  .refine(data => data.macdShortPeriod < data.macdLongPeriod, {
    message: 'macdShortPeriod must be less than macdLongPeriod',
    path: ['macdShortPeriod'],
  })
  .refine(data => data.rsiOversold < data.rsiOverbought, {
    message: 'rsiOversold must be less than rsiOverbought',
    path: ['rsiOversold'],
  });

export type MultiIndicatorConfluenceConfig = z.infer<typeof MultiIndicatorConfluenceSchema>;

export class MultiIndicatorConfluenceStrategy extends Strategy {
  static override NAME = '@typedtrader/strategy-multi-indicator-confluence';

  readonly #emaShort: EMA;
  readonly #emaLong: EMA;
  readonly #macd: MACD;
  readonly #bollingerBands: BollingerBands;
  readonly #rsi: RSI;
  #candlesProcessed = 0;

  constructor(config: MultiIndicatorConfluenceConfig) {
    super({config});

    this.#emaShort = new EMA(this.#config.emaShortPeriod);
    this.#emaLong = new EMA(this.#config.emaLongPeriod);
    this.#macd = new MACD(
      new EMA(this.#config.macdShortPeriod),
      new EMA(this.#config.macdLongPeriod),
      new EMA(this.#config.macdSignalPeriod)
    );
    this.#bollingerBands = new BollingerBands(this.#config.bollingerPeriod, this.#config.bollingerDeviationMultiplier);
    this.#rsi = new RSI(this.#config.rsiPeriod);
  }

  get #config(): MultiIndicatorConfluenceConfig {
    return this.getProxiedConfig<MultiIndicatorConfluenceConfig>();
  }

  /** Number of candles required before the strategy can produce signals. */
  get requiredWarmupCandles(): number {
    return Math.max(
      this.#config.emaLongPeriod,
      this.#config.bollingerPeriod,
      this.#config.macdLongPeriod + this.#config.macdSignalPeriod,
      this.#config.rsiPeriod + 1
    );
  }

  /** Whether all indicators have received enough data to produce stable results. */
  get isWarmedUp(): boolean {
    return (
      this.#emaShort.isStable &&
      this.#emaLong.isStable &&
      this.#rsi.isStable &&
      this.#bollingerBands.getResult() !== null &&
      this.#macd.getResult() !== null
    );
  }

  /** Number of candles processed so far. */
  get candlesProcessed(): number {
    return this.#candlesProcessed;
  }

  protected override async processCandle(candle: OneMinuteBatchedCandle, _state: TradingSessionState): Promise<OrderAdvice | void> {
    const closePrice = candle.close.toNumber();

    this.#emaShort.add(closePrice);
    this.#emaLong.add(closePrice);
    this.#macd.add(closePrice);
    this.#bollingerBands.add(closePrice);
    this.#rsi.add(closePrice);
    this.#candlesProcessed++;

    if (!this.isWarmedUp) {
      return;
    }

    const emaShortValue = this.#emaShort.getResult()!;
    const emaLongValue = this.#emaLong.getResult()!;
    const macdResult = this.#macd.getResult()!;
    const bollingerResult = this.#bollingerBands.getResult()!;
    const rsiValue = this.#rsi.getResult()!;

    const emaBullish = emaShortValue > emaLongValue;
    const emaBearish = emaShortValue < emaLongValue;
    const macdBullish = macdResult.histogram > 0;
    const macdBearish = macdResult.histogram < 0;
    const priceAtLowerBand = closePrice <= bollingerResult.lower;
    const priceAtUpperBand = closePrice >= bollingerResult.upper;
    const rsiNotOverbought = rsiValue < this.#config.rsiOverbought;
    const rsiNotOversold = rsiValue > this.#config.rsiOversold;

    // BUY: Uptrend + bullish momentum + pullback to lower band + RSI not overbought
    if (emaBullish && macdBullish && priceAtLowerBand && rsiNotOverbought) {
      const reason = [
        `EMA trend bullish (short ${emaShortValue.toFixed(2)} > long ${emaLongValue.toFixed(2)})`,
        `MACD momentum bullish (histogram ${macdResult.histogram.toFixed(4)})`,
        `Price ${closePrice.toFixed(2)} at/below lower Bollinger Band ${bollingerResult.lower.toFixed(2)}`,
        `RSI ${rsiValue.toFixed(2)} not overbought (< ${this.#config.rsiOverbought})`,
      ].join('; ');

      return {
        side: ExchangeOrderSide.BUY,
        type: ExchangeOrderType.MARKET,
        amount: null,
        amountIn: 'counter',
        reason,
      };
    }

    // SELL: Downtrend + bearish momentum + bounce to upper band + RSI not oversold
    if (emaBearish && macdBearish && priceAtUpperBand && rsiNotOversold) {
      const reason = [
        `EMA trend bearish (short ${emaShortValue.toFixed(2)} < long ${emaLongValue.toFixed(2)})`,
        `MACD momentum bearish (histogram ${macdResult.histogram.toFixed(4)})`,
        `Price ${closePrice.toFixed(2)} at/above upper Bollinger Band ${bollingerResult.upper.toFixed(2)}`,
        `RSI ${rsiValue.toFixed(2)} not oversold (> ${this.#config.rsiOversold})`,
      ].join('; ');

      return {
        side: ExchangeOrderSide.SELL,
        type: ExchangeOrderType.MARKET,
        amount: null,
        amountIn: 'base',
        reason,
      };
    }
  }
}
