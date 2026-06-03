import {AllAvailableAmount, OrderSide, OrderType} from '@typedtrader/exchange';
import type {OneMinuteBatchedCandle, OrderAdvice, TradingSessionState} from '@typedtrader/exchange';
import {BollingerBands, EMA, MACD, RSI} from 'trading-signals';
import {MarketType} from '../strategy/MarketType.js';
import {ProtectedStrategy} from '../strategy-protected/ProtectedStrategy.js';
import {MultiIndicatorConfluenceSchema, type MultiIndicatorConfluenceConfig} from './MultiIndicatorConfluenceSchema.js';

export {MultiIndicatorConfluenceSchema, type MultiIndicatorConfluenceConfig};

export class MultiIndicatorConfluenceStrategy extends ProtectedStrategy {
  static override NAME = '@typedtrader/strategy-multi-indicator-confluence';
  static override marketTypes: readonly MarketType[] = [MarketType.BULLISH, MarketType.BEARISH];

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
  get requiredWarmupCandles() {
    return Math.max(
      this.#config.emaLongPeriod,
      this.#config.bollingerPeriod,
      this.#config.macdLongPeriod + this.#config.macdSignalPeriod,
      this.#config.rsiPeriod + 1
    );
  }

  /** Whether all indicators have received enough data to produce stable results. */
  get isWarmedUp() {
    return (
      this.#emaShort.isStable &&
      this.#emaLong.isStable &&
      this.#rsi.isStable &&
      this.#bollingerBands.getResult() !== null &&
      this.#macd.getResult() !== null
    );
  }

  /** Number of candles processed so far. */
  get candlesProcessed() {
    return this.#candlesProcessed;
  }

  protected override async processCandle(
    candle: OneMinuteBatchedCandle,
    state: TradingSessionState
  ): Promise<OrderAdvice | void> {
    const guardAdvice = await super.processCandle(candle, state);
    if (guardAdvice) {
      return guardAdvice;
    }

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

    const emaShortValue = this.#emaShort.getResultOrThrow();
    const emaLongValue = this.#emaLong.getResultOrThrow();
    const macdResult = this.#macd.getResultOrThrow();
    const bollingerResult = this.#bollingerBands.getResultOrThrow();
    const rsiValue = this.#rsi.getResultOrThrow();

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
        amount: AllAvailableAmount,
        amountIn: 'counter',
        reason,
        side: OrderSide.BUY,
        type: OrderType.MARKET,
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
        amount: AllAvailableAmount,
        amountIn: 'base',
        reason,
        side: OrderSide.SELL,
        type: OrderType.MARKET,
      };
    }
  }
}
