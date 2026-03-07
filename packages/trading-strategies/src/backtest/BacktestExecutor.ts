import Big from 'big.js';
import {CandleBatcher, ExchangeOrderSide, ExchangeOrderType} from '@typedtrader/exchange';
import type {ExchangeCandle, ExchangeFeeRate, ExchangeTradingRules, OrderAdvice, TradingSessionState} from '@typedtrader/exchange';
import type {BacktestConfig} from './BacktestConfig.js';
import type {BacktestPerformanceSummary, BacktestResult, BacktestTrade} from './BacktestResult.js';
import {PerformanceCalculator} from './PerformanceCalculator.js';

export class BacktestExecutor {
  readonly #config: BacktestConfig;

  constructor(config: BacktestConfig) {
    this.#config = config;
  }

  async execute(): Promise<BacktestResult> {
    const {candles, exchange, strategy, tradingPair} = this.#config;

    const initialBalances = await exchange.getAvailableBalances(tradingPair);
    const initialBaseBalance = initialBalances.base;
    const initialCounterBalance = initialBalances.counter;

    // Fetch static values once before the loop
    const [tradingRules, feeRates] = await Promise.all([
      exchange.getTradingRules(tradingPair),
      exchange.getFeeRates(tradingPair),
    ]);

    const trades: BacktestTrade[] = [];
    let totalFees = new Big(0);

    for (const candle of candles) {
      // Step 1: Match pending orders from previous iteration against this candle
      const fills = exchange.processCandle(candle);

      for (const fill of fills) {
        trades.push({
          advice: this.#findAdviceForFill(fill.order_id, trades),
          fee: new Big(fill.fee),
          openTimeInISO: fill.created_at,
          price: new Big(fill.price),
          side: fill.side,
          size: new Big(fill.size),
        });
        totalFees = totalFees.plus(fill.fee);
      }

      // Step 2: Run strategy to get advice
      const batchedCandle = CandleBatcher.createBatchedCandle([candle], candle.sizeInMillis);
      const state = await this.#buildState(tradingPair, tradingRules, feeRates);
      const advice = await strategy.onCandle(batchedCandle, state);

      if (!advice) {
        continue;
      }

      // Step 3: Translate advice into exchange orders
      await this.#placeOrderFromAdvice(advice, tradingPair, tradingRules, feeRates);
    }

    // Cancel any orders placed on the last candle that were never filled.
    // This releases their held balances back to available so the final stats
    // correctly reflect what the portfolio actually holds.
    await exchange.cancelOpenOrders(tradingPair);

    const finalBalances = await exchange.getAvailableBalances(tradingPair);
    const firstOpenPrice = candles.length > 0 ? new Big(candles[0].open) : new Big(0);
    const lastClosePrice = candles.length > 0 ? new Big(candles[candles.length - 1].close) : new Big(0);

    const initialPortfolioValue = initialBaseBalance.mul(firstOpenPrice).plus(initialCounterBalance);
    const finalPortfolioValue = finalBalances.base.mul(lastClosePrice).plus(finalBalances.counter);
    const profitOrLoss = finalPortfolioValue.minus(initialPortfolioValue);

    const performance = this.#buildPerformanceSummary(trades, candles, initialPortfolioValue, finalPortfolioValue);

    return {
      finalBaseBalance: finalBalances.base,
      finalCounterBalance: finalBalances.counter,
      initialBaseBalance,
      initialCounterBalance,
      performance,
      profitOrLoss,
      totalCandles: candles.length,
      totalFees,
      trades,
    };
  }

  /** Map to track which order_id corresponds to which advice */
  readonly #orderAdviceMap = new Map<string, OrderAdvice>();

  #findAdviceForFill(orderId: string, _trades: BacktestTrade[]): OrderAdvice {
    const advice = this.#orderAdviceMap.get(orderId);
    if (!advice) {
      // Fallback: shouldn't happen in normal flow
      return {
        side: ExchangeOrderSide.BUY,
        type: ExchangeOrderType.MARKET,
        amount: null,
        amountInCounter: false,
      };
    }
    return advice;
  }

  async #buildState(
    pair: import('@typedtrader/exchange').TradingPair,
    tradingRules: ExchangeTradingRules,
    feeRates: ExchangeFeeRate
  ): Promise<TradingSessionState> {
    const {exchange} = this.#config;
    const [balances, fills] = await Promise.all([exchange.getAvailableBalances(pair), exchange.getFills(pair)]);
    const lastOrderSide = fills.length > 0 ? fills[0].side : undefined;

    return {
      baseBalance: balances.base,
      counterBalance: balances.counter,
      tradingRules,
      feeRates,
      lastOrderSide,
    };
  }

  async #placeOrderFromAdvice(
    advice: OrderAdvice,
    pair: import('@typedtrader/exchange').TradingPair,
    tradingRules: ExchangeTradingRules,
    feeRates: ExchangeFeeRate
  ): Promise<void> {
    const {exchange} = this.#config;

    try {
      if (advice.type === ExchangeOrderType.LIMIT) {
        const rawPrice = new Big(advice.price!);
        const price = this.#roundLimitPrice(rawPrice, tradingRules);

        if (price.lte(0)) {
          return;
        }

        const balances = await exchange.getAvailableBalances(pair);

        let size: Big;
        if (advice.side === ExchangeOrderSide.BUY) {
          if (advice.amountInCounter) {
            const spendAmount = advice.amount !== null ? new Big(advice.amount) : balances.counter;
            if (spendAmount.lte(0) || balances.counter.lte(0)) {
              return;
            }
            const actualSpend = spendAmount.gt(balances.counter) ? balances.counter : spendAmount;
            const feeRate = feeRates[ExchangeOrderType.LIMIT];
            const netSpend = actualSpend.div(new Big(1).plus(feeRate));
            size = netSpend.div(price);
          } else {
            if (advice.amount !== null) {
              size = new Big(advice.amount);
            } else {
              const feeRate = feeRates[ExchangeOrderType.LIMIT];
              const netSpend = balances.counter.div(new Big(1).plus(feeRate));
              size = netSpend.div(price);
            }
          }
        } else {
          // SELL
          const amount = advice.amount !== null ? new Big(advice.amount) : balances.base;
          if (amount.lte(0) || balances.base.lte(0)) {
            return;
          }
          size = amount.gt(balances.base) ? balances.base : amount;
        }

        if (size.lte(0)) {
          return;
        }

        const order = await exchange.placeLimitOrder(pair, {
          price: price.toFixed(),
          side: advice.side,
          size: size.toFixed(),
        });
        this.#orderAdviceMap.set(order.id, advice);
      } else {
        // MARKET order
        const balances = await exchange.getAvailableBalances(pair);

        if (advice.side === ExchangeOrderSide.BUY) {
          if (advice.amountInCounter) {
            const spendAmount = advice.amount !== null ? new Big(advice.amount) : balances.counter;
            if (spendAmount.lte(0) || balances.counter.lte(0)) {
              return;
            }
            const actualSpend = spendAmount.gt(balances.counter) ? balances.counter : spendAmount;
            const latestCandle = await exchange.getLatestCandle(pair, 0);
            const estimatedPrice = new Big(latestCandle.close);
            if (estimatedPrice.eq(0)) {
              return;
            }
            const feeRate = feeRates[ExchangeOrderType.MARKET];
            const netSpend = actualSpend.div(new Big(1).plus(feeRate));
            const size = netSpend.div(estimatedPrice);

            if (size.lte(0)) {
              return;
            }

            const order = await exchange.placeMarketOrder(pair, {
              side: ExchangeOrderSide.BUY,
              size: size.toFixed(),
              sizeInCounter: false,
            });
            this.#orderAdviceMap.set(order.id, advice);
          } else {
            if (advice.amount === null) {
              // Cannot resolve base-denomination size without an explicit amount or amountInCounter
              return;
            }
            const size = new Big(advice.amount);
            if (size.lte(0)) {
              return;
            }

            const order = await exchange.placeMarketOrder(pair, {
              side: ExchangeOrderSide.BUY,
              size: size.toFixed(),
              sizeInCounter: false,
            });
            this.#orderAdviceMap.set(order.id, advice);
          }
        } else {
          // SELL MARKET
          const amount = advice.amount !== null ? new Big(advice.amount) : balances.base;
          if (amount.lte(0) || balances.base.lte(0)) {
            return;
          }
          const actualSize = amount.gt(balances.base) ? balances.base : amount;

          const order = await exchange.placeMarketOrder(pair, {
            side: ExchangeOrderSide.SELL,
            size: actualSize.toFixed(),
            sizeInCounter: false,
          });
          this.#orderAdviceMap.set(order.id, advice);
        }
      }
    } catch {
      // Order rejected (insufficient balance, trading rules, etc.) - skip
    }
  }

  /** Rounds a limit-order price down to the exchange's counter_increment. */
  #roundLimitPrice(rawPrice: Big, tradingRules: ExchangeTradingRules): Big {
    const counterIncrement = new Big(tradingRules.counter_increment);
    return rawPrice.div(counterIncrement).round(0, Big.roundDown).mul(counterIncrement);
  }

  #buildPerformanceSummary(
    trades: BacktestTrade[],
    candles: ExchangeCandle[],
    initialPortfolioValue: Big,
    finalPortfolioValue: Big
  ): BacktestPerformanceSummary {
    const returnPercentage = initialPortfolioValue.gt(0)
      ? finalPortfolioValue.minus(initialPortfolioValue).div(initialPortfolioValue).mul(100)
      : new Big(0);

    const winRate = PerformanceCalculator.calculateWinRate(trades);
    const buyAndHoldReturnPercentage = PerformanceCalculator.calculateBuyAndHoldReturn(candles);
    const {maxWinStreak, maxLossStreak} = PerformanceCalculator.calculateStreaks(trades);

    return {
      buyAndHoldReturnPercentage,
      finalPortfolioValue,
      initialPortfolioValue,
      maxLossStreak,
      maxWinStreak,
      returnPercentage,
      totalTrades: trades.length,
      winRate,
    };
  }
}
