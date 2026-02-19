import Big from 'big.js';
import {CandleBatcher, ExchangeCandle, ExchangeOrderSide, ExchangeOrderType} from '@typedtrader/exchange';
import type {BacktestConfig} from './BacktestConfig.js';
import type {BacktestPerformanceSummary, BacktestResult, BacktestTrade} from './BacktestResult.js';
import {StrategySignal} from '../strategy/StrategySignal.js';
import type {StrategyAdvice} from '../strategy/StrategyAdvice.js';
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
      const advice = await strategy.processBatchedCandle(batchedCandle);

      if (!advice) {
        continue;
      }

      // Step 3: Translate advice into exchange orders
      await this.#placeOrderFromAdvice(advice, tradingPair);
    }

    // Process one final "empty" candle pass to match any remaining pending orders
    // using the last candle (they would fill on the next candle in real trading)

    const finalBalances = await exchange.getAvailableBalances(tradingPair);
    const lastClosePrice = candles.length > 0 ? new Big(candles[candles.length - 1].close) : new Big(0);

    const initialPortfolioValue = initialBaseBalance.mul(lastClosePrice).plus(initialCounterBalance);
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
  readonly #orderAdviceMap = new Map<string, StrategyAdvice>();

  #findAdviceForFill(orderId: string, _trades: BacktestTrade[]): StrategyAdvice {
    const advice = this.#orderAdviceMap.get(orderId);
    if (!advice) {
      // Fallback: shouldn't happen in normal flow
      return {
        amount: null,
        amountType: 'base',
        price: null,
        signal: StrategySignal.BUY_MARKET,
      };
    }
    return advice;
  }

  async #placeOrderFromAdvice(advice: StrategyAdvice, pair: import('@typedtrader/exchange').TradingPair): Promise<void> {
    const {exchange} = this.#config;
    const signal = advice.signal;

    try {
      switch (signal) {
        case StrategySignal.BUY_LIMIT: {
          const balances = await exchange.getAvailableBalances(pair);
          // Apply trading-rule rounding to the price before any size calculations,
          // so size and reachability checks are consistent with the actual fill price.
          const price = await this.#roundLimitPrice(advice.price, pair);

          if (price.lte(0)) {
            return;
          }

          let size: Big;

          if (advice.amountType === 'counter') {
            const spendAmount = advice.amount ?? balances.counter;
            if (spendAmount.lte(0) || balances.counter.lte(0)) {
              return;
            }
            const actualSpend = spendAmount.gt(balances.counter) ? balances.counter : spendAmount;
            // Estimate fee so we don't over-commit
            const feeRate = (await exchange.getFeeRates(pair))[ExchangeOrderType.LIMIT];
            const netSpend = actualSpend.div(new Big(1).plus(feeRate));
            size = netSpend.div(price);
          } else {
            if (advice.amount) {
              size = advice.amount;
            } else {
              // Buy as much as possible: account for fees in size calculation
              const feeRate = (await exchange.getFeeRates(pair))[ExchangeOrderType.LIMIT];
              const netSpend = balances.counter.div(new Big(1).plus(feeRate));
              size = netSpend.div(price);
            }
          }

          if (size.lte(0)) {
            return;
          }

          const order = await exchange.placeLimitOrder(pair, {
            price: price.toFixed(),
            side: ExchangeOrderSide.BUY,
            size: size.toFixed(),
          });
          this.#orderAdviceMap.set(order.id, advice);
          break;
        }

        case StrategySignal.BUY_MARKET: {
          const balances = await exchange.getAvailableBalances(pair);

          if (advice.amountType === 'counter') {
            const spendAmount = advice.amount ?? balances.counter;
            if (spendAmount.lte(0) || balances.counter.lte(0)) {
              return;
            }
            const actualSpend = spendAmount.gt(balances.counter) ? balances.counter : spendAmount;
            // For market orders with counter amount, we need to estimate the size
            // using the current candle price
            const latestCandle = await exchange.getLatestCandle(pair, 0);
            const estimatedPrice = new Big(latestCandle.close);
            if (estimatedPrice.eq(0)) {
              return;
            }
            const feeRate = (await exchange.getFeeRates(pair))[ExchangeOrderType.MARKET];
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
            const size = advice.amount ?? balances.counter;
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
          break;
        }

        case StrategySignal.SELL_LIMIT: {
          const balances = await exchange.getAvailableBalances(pair);
          // Apply trading-rule rounding to the price before placing the order,
          // so the order price is consistent with what the exchange will use for fills.
          const price = await this.#roundLimitPrice(advice.price, pair);

          if (price.lte(0)) {
            return;
          }

          const size = advice.amount ?? balances.base;
          if (size.lte(0) || balances.base.lte(0)) {
            return;
          }
          const actualSize = size.gt(balances.base) ? balances.base : size;

          const order = await exchange.placeLimitOrder(pair, {
            price: price.toFixed(),
            side: ExchangeOrderSide.SELL,
            size: actualSize.toFixed(),
          });
          this.#orderAdviceMap.set(order.id, advice);
          break;
        }

        case StrategySignal.SELL_MARKET: {
          const balances = await exchange.getAvailableBalances(pair);
          const size = advice.amount ?? balances.base;
          if (size.lte(0) || balances.base.lte(0)) {
            return;
          }
          const actualSize = size.gt(balances.base) ? balances.base : size;

          const order = await exchange.placeMarketOrder(pair, {
            side: ExchangeOrderSide.SELL,
            size: actualSize.toFixed(),
            sizeInCounter: false,
          });
          this.#orderAdviceMap.set(order.id, advice);
          break;
        }
      }
    } catch {
      // Order rejected (insufficient balance, trading rules, etc.) - skip
    }
  }

  /** Rounds a limit-order price down to the exchange's counter_increment. */
  async #roundLimitPrice(rawPrice: Big, pair: import('@typedtrader/exchange').TradingPair): Promise<Big> {
    const {exchange} = this.#config;
    const tradingRules = await exchange.getTradingRules(pair);
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
