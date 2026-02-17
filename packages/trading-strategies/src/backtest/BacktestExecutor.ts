import Big from 'big.js';
import {CandleBatcher, ExchangeOrderType} from '@typedtrader/exchange';
import type {ExchangeTradingRules} from '@typedtrader/exchange';
import type {BacktestConfig} from './BacktestConfig.js';
import type {BacktestPerformanceSummary, BacktestResult, BacktestTrade} from './BacktestResult.js';
import {StrategySignal} from '../strategy/StrategySignal.js';
import type {StrategyAdvice} from '../strategy/StrategyAdvice.js';

export class BacktestExecutor {
  readonly #config: BacktestConfig;

  constructor(config: BacktestConfig) {
    this.#config = config;
  }

  async execute(): Promise<BacktestResult> {
    const {candles, feeRates, initialBaseBalance, initialCounterBalance, strategy} = this.#config;

    let baseBalance = new Big(initialBaseBalance);
    let counterBalance = new Big(initialCounterBalance);
    const trades: BacktestTrade[] = [];
    let totalFees = new Big(0);

    for (const candle of candles) {
      const batchedCandle = CandleBatcher.createBatchedCandle([candle], candle.sizeInMillis);
      const advice = await strategy.processBatchedCandle(batchedCandle);

      if (!advice) {
        continue;
      }

      const currentClosePrice = new Big(candle.close);
      const candleLow = new Big(candle.low);
      const candleHigh = new Big(candle.high);
      const trade = this.#executeTrade({
        advice,
        baseBalance,
        candleHigh,
        candleLow,
        counterBalance,
        currentClosePrice,
        feeRates,
        openTimeInISO: candle.openTimeInISO,
      });

      if (!trade) {
        continue;
      }

      baseBalance = trade.newBaseBalance;
      counterBalance = trade.newCounterBalance;
      totalFees = totalFees.plus(trade.trade.fee);
      trades.push(trade.trade);
    }

    const lastClosePrice = candles.length > 0 ? new Big(candles[candles.length - 1].close) : new Big(0);

    const initialPortfolioValue = initialBaseBalance.mul(lastClosePrice).plus(initialCounterBalance);
    const finalPortfolioValue = baseBalance.mul(lastClosePrice).plus(counterBalance);
    const profitOrLoss = finalPortfolioValue.minus(initialPortfolioValue);

    const performance = this.#buildPerformanceSummary(trades, initialPortfolioValue, finalPortfolioValue);

    return {
      finalBaseBalance: baseBalance,
      finalCounterBalance: counterBalance,
      initialBaseBalance: new Big(initialBaseBalance),
      initialCounterBalance: new Big(initialCounterBalance),
      performance,
      profitOrLoss,
      totalCandles: candles.length,
      totalFees,
      trades,
    };
  }

  #buildPerformanceSummary(
    trades: BacktestTrade[],
    initialPortfolioValue: Big,
    finalPortfolioValue: Big
  ): BacktestPerformanceSummary {
    const returnPercentage = initialPortfolioValue.gt(0)
      ? finalPortfolioValue.minus(initialPortfolioValue).div(initialPortfolioValue).mul(100)
      : new Big(0);

    // Win rate: pair buys with subsequent sells into round-trip cycles
    const winRate = this.#calculateWinRate(trades);

    return {
      finalPortfolioValue,
      initialPortfolioValue,
      returnPercentage,
      totalTrades: trades.length,
      winRate,
    };
  }

  /**
   * Calculates win rate by pairing buy trades with subsequent sell trades into round-trip cycles.
   * A cycle is "won" when the volume-weighted average sell price exceeds the volume-weighted average buy price.
   */
  #calculateWinRate(trades: BacktestTrade[]): Big {
    const cycles: {buyAvgPrice: Big; sellAvgPrice: Big}[] = [];
    let pendingBuys: BacktestTrade[] = [];

    for (const trade of trades) {
      const isBuy =
        trade.advice.signal === StrategySignal.BUY_LIMIT || trade.advice.signal === StrategySignal.BUY_MARKET;

      if (isBuy) {
        pendingBuys.push(trade);
      } else if (pendingBuys.length > 0) {
        // Close a cycle
        const totalBuySize = pendingBuys.reduce((s, t) => s.plus(t.size), new Big(0));
        const buyAvgPrice = pendingBuys.reduce((s, t) => s.plus(t.price.mul(t.size)), new Big(0)).div(totalBuySize);

        cycles.push({
          buyAvgPrice,
          sellAvgPrice: trade.price,
        });

        pendingBuys = [];
      }
    }

    if (cycles.length === 0) {
      return new Big(0);
    }

    const wins = cycles.filter(c => c.sellAvgPrice.gt(c.buyAvgPrice)).length;

    return new Big(wins).div(cycles.length).mul(100);
  }

  #executeTrade(params: {
    advice: StrategyAdvice;
    baseBalance: Big;
    candleHigh: Big;
    candleLow: Big;
    counterBalance: Big;
    currentClosePrice: Big;
    feeRates: {[ExchangeOrderType.LIMIT]: Big; [ExchangeOrderType.MARKET]: Big};
    openTimeInISO: string;
  }) {
    const {advice, baseBalance, candleHigh, candleLow, counterBalance, currentClosePrice, feeRates, openTimeInISO} =
      params;
    const signal = advice.signal;
    const rules = this.#config.tradingRules;

    // For limit orders with an explicit price, verify the price is reachable within the candle's range
    const isLimitOrder = signal === StrategySignal.BUY_LIMIT || signal === StrategySignal.SELL_LIMIT;

    if (isLimitOrder && advice.price !== null) {
      if (advice.price.lt(candleLow) || advice.price.gt(candleHigh)) {
        return null;
      }
    }

    switch (signal) {
      case StrategySignal.BUY_LIMIT:
      case StrategySignal.BUY_MARKET: {
        const feeRate =
          signal === StrategySignal.BUY_LIMIT ? feeRates[ExchangeOrderType.LIMIT] : feeRates[ExchangeOrderType.MARKET];
        let price = advice.price ?? currentClosePrice;

        if (price.eq(0)) {
          return null;
        }

        let size: Big;

        if (advice.amountType === 'counter') {
          // Spending counter currency
          const spendAmount = advice.amount ?? counterBalance;

          if (spendAmount.lte(0) || counterBalance.lte(0)) {
            return null;
          }

          const actualSpend = spendAmount.gt(counterBalance) ? counterBalance : spendAmount;
          let fee = actualSpend.mul(feeRate);
          const netSpend = actualSpend.minus(fee);
          size = netSpend.div(price);

          if (rules) {
            const adjusted = this.#applyTradingRules(size, price, rules);

            if (!adjusted) {
              return null;
            }

            size = adjusted.size;
            price = adjusted.price;

            // Recalculate cost consistently: netSpend = size * price, actualSpend = netSpend / (1 - feeRate)
            const adjustedNetSpend = size.mul(price);
            const adjustedSpend = adjustedNetSpend.div(new Big(1).minus(feeRate));
            fee = adjustedSpend.mul(feeRate);

            return {
              newBaseBalance: baseBalance.plus(size),
              newCounterBalance: counterBalance.minus(adjustedSpend),
              trade: {
                advice,
                fee,
                openTimeInISO,
                price,
                size,
              } satisfies BacktestTrade,
            };
          }

          return {
            newBaseBalance: baseBalance.plus(size),
            newCounterBalance: counterBalance.minus(actualSpend),
            trade: {
              advice,
              fee,
              openTimeInISO,
              price,
              size,
            } satisfies BacktestTrade,
          };
        } else {
          // Buying a specific base amount
          size = advice.amount ?? counterBalance.div(price);

          if (size.lte(0)) {
            return null;
          }

          if (rules) {
            const adjusted = this.#applyTradingRules(size, price, rules);

            if (!adjusted) {
              return null;
            }

            size = adjusted.size;
            price = adjusted.price;
          }

          const cost = size.mul(price);
          const fee = cost.mul(feeRate);
          const totalCost = cost.plus(fee);

          if (totalCost.gt(counterBalance)) {
            // Not enough counter balance; buy as much as we can afford
            const affordableTotal = counterBalance;
            const affordableFee = affordableTotal.mul(feeRate).div(new Big(1).plus(feeRate));
            const affordableNetSpend = affordableTotal.minus(affordableFee);
            size = affordableNetSpend.div(price);

            if (rules) {
              const adjusted = this.#applyTradingRules(size, price, rules);

              if (!adjusted) {
                return null;
              }

              size = adjusted.size;
              price = adjusted.price;
            }

            if (size.lte(0)) {
              return null;
            }

            const adjCost = size.mul(price);
            const adjFee = adjCost.mul(feeRate);
            const adjTotal = adjCost.plus(adjFee);

            return {
              newBaseBalance: baseBalance.plus(size),
              newCounterBalance: counterBalance.minus(adjTotal),
              trade: {
                advice,
                fee: adjFee,
                openTimeInISO,
                price,
                size,
              } satisfies BacktestTrade,
            };
          }

          return {
            newBaseBalance: baseBalance.plus(size),
            newCounterBalance: counterBalance.minus(totalCost),
            trade: {
              advice,
              fee,
              openTimeInISO,
              price,
              size,
            } satisfies BacktestTrade,
          };
        }
      }

      case StrategySignal.SELL_LIMIT:
      case StrategySignal.SELL_MARKET: {
        const feeRate =
          signal === StrategySignal.SELL_LIMIT ? feeRates[ExchangeOrderType.LIMIT] : feeRates[ExchangeOrderType.MARKET];
        let price = advice.price ?? currentClosePrice;

        if (price.eq(0)) {
          return null;
        }

        let size: Big = advice.amount ?? baseBalance;

        if (size.lte(0) || baseBalance.lte(0)) {
          return null;
        }

        if (size.gt(baseBalance)) {
          size = baseBalance;
        }

        if (rules) {
          const adjusted = this.#applyTradingRules(size, price, rules);

          if (!adjusted) {
            return null;
          }

          size = adjusted.size;
          price = adjusted.price;
        }

        const revenue = size.mul(price);
        const fee = revenue.mul(feeRate);
        const netRevenue = revenue.minus(fee);

        return {
          newBaseBalance: baseBalance.minus(size),
          newCounterBalance: counterBalance.plus(netRevenue),
          trade: {
            advice,
            fee,
            openTimeInISO,
            price,
            size,
          } satisfies BacktestTrade,
        };
      }

      default:
        return null;
    }
  }

  /**
   * Rounds a value down to the nearest multiple of the given increment.
   * For example, roundDown(0.123456, 0.0001) returns 0.1234.
   */
  #roundDown(value: Big, increment: Big): Big {
    return value.div(increment).round(0, Big.roundDown).mul(increment);
  }

  /**
   * Applies trading rules to a computed size.
   * Returns the adjusted size, or null if the trade should be skipped.
   */
  #applyTradingRules(size: Big, price: Big, rules: ExchangeTradingRules): {price: Big; size: Big} | null {
    const baseIncrement = new Big(rules.base_increment);
    const baseMinSize = new Big(rules.base_min_size);
    const counterMinSize = new Big(rules.counter_min_size);
    const counterIncrement = new Big(rules.counter_increment);

    // Round size down to the nearest base increment
    size = this.#roundDown(size, baseIncrement);

    if (size.lt(baseMinSize)) {
      return null;
    }

    // Round price to the nearest counter increment
    price = this.#roundDown(price, counterIncrement);

    // Check minimum notional value (size × price must be ≥ counter_min_size)
    const notional = size.mul(price);

    if (notional.lt(counterMinSize)) {
      return null;
    }

    return {price, size};
  }
}
