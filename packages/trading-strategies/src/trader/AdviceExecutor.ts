import Big from 'big.js';
import {OrderSide, OrderType} from '@typedtrader/exchange';
import type {ExchangeAvailableBalance, FeeRate, PendingOrder, TradingPair, TradingRules} from '@typedtrader/exchange';
import {OrderSizeBelowMinimumError} from './OrderSizeBelowMinimumError.js';
import {AllAvailableAmount} from './TradingSessionTypes.js';
import type {OrderAdvice, TradingSessionBroker} from './TradingSessionTypes.js';

export type AdviceExecutorBroker = Pick<
  TradingSessionBroker,
  'getAvailableBalances' | 'placeLimitOrder' | 'placeMarketOrder'
>;

export type AdviceExecution =
  | {status: 'PLACED'; order: PendingOrder; balances: ExchangeAvailableBalance}
  | {status: 'SKIPPED'; error: Error; balances: ExchangeAvailableBalance};

interface ResolvedOrderSize {
  size: Big;
  sizeInCounter: boolean;
  minimumSize: string;
}

/**
 * The single translation from a strategy's {@link OrderAdvice} to a broker order.
 * `TradingSession` (live) and `BacktestExecutor` (historical) both delegate here, so a
 * backtest sizes, clamps, and validates orders exactly like a live session would —
 * keeping the two paths from silently diverging is this class's entire reason to exist.
 */
export class AdviceExecutor {
  readonly #broker: AdviceExecutorBroker;
  readonly #pair: TradingPair;
  readonly #tradingRules: TradingRules;
  readonly #feeRates: FeeRate;

  constructor(options: {
    broker: AdviceExecutorBroker;
    pair: TradingPair;
    tradingRules: TradingRules;
    feeRates: FeeRate;
  }) {
    this.#broker = options.broker;
    this.#pair = options.pair;
    this.#tradingRules = options.tradingRules;
    this.#feeRates = options.feeRates;
  }

  /**
   * Balances are re-fetched on every call because fills may have changed them since the
   * advice was produced. Placement failures are returned as a `SKIPPED` outcome instead of
   * thrown, so callers always learn about dropped advice — a backtest that silently eats a
   * rejected order reports results a live session would never achieve.
   */
  async execute(advice: OrderAdvice): Promise<AdviceExecution> {
    const balances = await this.#broker.getAvailableBalances(this.#pair);

    if (advice.type === OrderType.LIMIT) {
      const price = this.#applyPrecision(new Big(advice.price), this.#tradingRules.counter_increment);

      if (price.lte(0)) {
        return {
          balances,
          error: new Error(`Limit price "${new Big(advice.price).toFixed()}" rounds to zero and cannot be placed`),
          status: 'SKIPPED',
        };
      }

      const resolved = this.#resolveLimitOrderSize(advice, balances, price);
      const belowMinimum = this.#checkMinimumSize(advice, resolved);

      if (belowMinimum) {
        return {balances, error: belowMinimum, status: 'SKIPPED'};
      }

      try {
        const order = await this.#broker.placeLimitOrder(this.#pair, {
          price: price.toFixed(),
          side: advice.side,
          size: resolved.size.toFixed(),
        });
        return {balances, order, status: 'PLACED'};
      } catch (error) {
        return {balances, error: toError(error), status: 'SKIPPED'};
      }
    }

    const resolved = this.#resolveMarketOrderSize(advice, balances);
    const belowMinimum = this.#checkMinimumSize(advice, resolved);

    if (belowMinimum) {
      return {balances, error: belowMinimum, status: 'SKIPPED'};
    }

    try {
      const order = await this.#broker.placeMarketOrder(this.#pair, {
        side: advice.side,
        size: resolved.size.toFixed(),
        sizeInCounter: resolved.sizeInCounter,
      });
      return {balances, order, status: 'PLACED'};
    } catch (error) {
      return {balances, error: toError(error), status: 'SKIPPED'};
    }
  }

  /** Limit advice is always sized in base currency (enforced by {@link LimitOrderAdvice}). */
  #resolveLimitOrderSize(
    advice: Extract<OrderAdvice, {type: 'LIMIT'}>,
    balances: ExchangeAvailableBalance,
    price: Big
  ): ResolvedOrderSize {
    const {base_increment, base_min_size} = this.#tradingRules;

    let amount: Big;

    if (advice.amount === AllAvailableAmount) {
      if (advice.side === OrderSide.BUY) {
        /*
         * Fees are charged on top of the notional, so spending the full counter balance on
         * the order itself would leave nothing for the fee and get the order rejected.
         */
        const netSpend = balances.counter.div(new Big(1).plus(this.#feeRates[OrderType.LIMIT]));
        amount = netSpend.div(price);
      } else {
        amount = balances.base;
      }
    } else if (advice.side === OrderSide.SELL) {
      // Never offer more than we hold: a sell above the balance is a guaranteed rejection.
      const requested = new Big(advice.amount);
      amount = requested.gt(balances.base) ? balances.base : requested;
    } else {
      amount = new Big(advice.amount);
    }

    return {
      minimumSize: base_min_size,
      size: this.#applyPrecision(amount, base_increment),
      sizeInCounter: false,
    };
  }

  #resolveMarketOrderSize(
    advice: Extract<OrderAdvice, {type: 'MARKET'}>,
    balances: ExchangeAvailableBalance
  ): ResolvedOrderSize {
    const {base_increment, base_min_size, counter_increment, counter_min_size} = this.#tradingRules;

    if (advice.side === OrderSide.BUY && advice.amountIn === 'counter') {
      // Notional buy: the broker converts at the actual fill price, so no price estimate is needed here.
      const requested = advice.amount === AllAvailableAmount ? balances.counter : new Big(advice.amount);
      const amount = requested.gt(balances.counter) ? balances.counter : requested;
      return {
        minimumSize: counter_min_size,
        size: this.#applyPrecision(amount, counter_increment),
        sizeInCounter: true,
      };
    }

    if (advice.side === OrderSide.BUY) {
      // BUY in base: the amount is always explicit (enforced by MarketBuyBaseAdvice).
      return {
        minimumSize: base_min_size,
        size: this.#applyPrecision(new Big(advice.amount), base_increment),
        sizeInCounter: false,
      };
    }

    // SELL
    if (advice.amount === AllAvailableAmount) {
      // "Sell everything" always means the full base holding, even when the advice is denominated in counter.
      return {
        minimumSize: base_min_size,
        size: this.#applyPrecision(balances.base, base_increment),
        sizeInCounter: false,
      };
    }

    if (advice.amountIn === 'counter') {
      // Notional sell: the broker sells however much base is needed to receive this counter amount.
      return {
        minimumSize: counter_min_size,
        size: this.#applyPrecision(new Big(advice.amount), counter_increment),
        sizeInCounter: true,
      };
    }

    const requested = new Big(advice.amount);
    const amount = requested.gt(balances.base) ? balances.base : requested;
    return {
      minimumSize: base_min_size,
      size: this.#applyPrecision(amount, base_increment),
      sizeInCounter: false,
    };
  }

  #checkMinimumSize(advice: OrderAdvice, resolved: ResolvedOrderSize): OrderSizeBelowMinimumError | null {
    if (resolved.size.lt(resolved.minimumSize)) {
      return new OrderSizeBelowMinimumError({
        amountIn: advice.amountIn,
        minimumSize: resolved.minimumSize,
        side: advice.side,
        size: resolved.size.toFixed(),
      });
    }
    return null;
  }

  #applyPrecision(value: Big, increment: string): Big {
    const inc = new Big(increment);
    return value.div(inc).round(0, Big.roundDown).mul(inc);
  }
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}
