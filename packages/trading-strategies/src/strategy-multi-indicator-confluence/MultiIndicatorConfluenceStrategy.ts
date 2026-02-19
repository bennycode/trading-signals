import type {BatchedCandle} from '@typedtrader/exchange';
import {BollingerBands, EMA, MACD, RSI} from 'trading-signals';
import type {StrategyAdvice, StrategyAdviceMarketBuyOrder, StrategyAdviceMarketSellOrder} from '../strategy/StrategyAdvice.js';
import {StrategySignal} from '../strategy/StrategySignal.js';
import {Strategy} from '../strategy/Strategy.js';

export interface MultiIndicatorConfluenceConfig {
  /** EMA short period for trend detection. */
  emaShortPeriod: number;
  /** EMA long period for trend detection. */
  emaLongPeriod: number;
  /** MACD short EMA period. */
  macdShortPeriod: number;
  /** MACD long EMA period. */
  macdLongPeriod: number;
  /** MACD signal EMA period. */
  macdSignalPeriod: number;
  /** Bollinger Bands period. */
  bollingerPeriod: number;
  /** Bollinger Bands standard deviation multiplier. */
  bollingerDeviationMultiplier: number;
  /** RSI period. */
  rsiPeriod: number;
  /** RSI overbought threshold (veto BUY above this). */
  rsiOverbought: number;
  /** RSI oversold threshold (veto SELL below this). */
  rsiOversold: number;
}

const DEFAULT_CONFIG: MultiIndicatorConfluenceConfig = {
  emaShortPeriod: 12,
  emaLongPeriod: 26,
  macdShortPeriod: 12,
  macdLongPeriod: 26,
  macdSignalPeriod: 9,
  bollingerPeriod: 20,
  bollingerDeviationMultiplier: 2,
  rsiPeriod: 14,
  rsiOverbought: 70,
  rsiOversold: 30,
};

/** Recommended candle interval: 1 day in milliseconds. */
export const RECOMMENDED_INTERVAL_IN_MILLIS = 86_400_000;

export class MultiIndicatorConfluenceStrategy extends Strategy {
  static override NAME = '@typedtrader/strategy-multi-indicator-confluence';

  readonly #config: MultiIndicatorConfluenceConfig;
  readonly #emaShort: EMA;
  readonly #emaLong: EMA;
  readonly #macd: MACD;
  readonly #bollingerBands: BollingerBands;
  readonly #rsi: RSI;
  #candlesProcessed = 0;

  constructor(config: Partial<MultiIndicatorConfluenceConfig> = {}) {
    super();
    this.#config = {...DEFAULT_CONFIG, ...config};

    this.#emaShort = new EMA(this.#config.emaShortPeriod);
    this.#emaLong = new EMA(this.#config.emaLongPeriod);
    this.#macd = new MACD(
      new EMA(this.#config.macdShortPeriod),
      new EMA(this.#config.macdLongPeriod),
      new EMA(this.#config.macdSignalPeriod),
    );
    this.#bollingerBands = new BollingerBands(this.#config.bollingerPeriod, this.#config.bollingerDeviationMultiplier);
    this.#rsi = new RSI(this.#config.rsiPeriod);
  }

  /** Number of candles required before the strategy can produce signals. */
  get requiredWarmupCandles(): number {
    return Math.max(
      this.#config.emaLongPeriod,
      this.#config.bollingerPeriod,
      this.#config.macdLongPeriod + this.#config.macdSignalPeriod,
      this.#config.rsiPeriod + 1,
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

  protected override async processCandle(candle: BatchedCandle): Promise<StrategyAdvice | void> {
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

      const buyMarket: StrategyAdviceMarketBuyOrder = {
        amount: null,
        amountType: 'base',
        price: null,
        signal: StrategySignal.BUY_MARKET,
        reason,
      };

      return buyMarket;
    }

    // SELL: Downtrend + bearish momentum + bounce to upper band + RSI not oversold
    if (emaBearish && macdBearish && priceAtUpperBand && rsiNotOversold) {
      const reason = [
        `EMA trend bearish (short ${emaShortValue.toFixed(2)} < long ${emaLongValue.toFixed(2)})`,
        `MACD momentum bearish (histogram ${macdResult.histogram.toFixed(4)})`,
        `Price ${closePrice.toFixed(2)} at/above upper Bollinger Band ${bollingerResult.upper.toFixed(2)}`,
        `RSI ${rsiValue.toFixed(2)} not oversold (> ${this.#config.rsiOversold})`,
      ].join('; ');

      const sellMarket: StrategyAdviceMarketSellOrder = {
        amount: null,
        amountType: 'base',
        price: null,
        signal: StrategySignal.SELL_MARKET,
        reason,
      };

      return sellMarket;
    }
  }
}
