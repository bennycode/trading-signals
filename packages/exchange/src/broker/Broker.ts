import Big from 'big.js';
import {EventEmitter} from 'node:events';
import type {TradingPair} from './TradingPair.js';

export {CandleBaseSchema, CandleSchema} from '../schemas.js';
export type {Candle, CandleBase} from '../schemas.js';

export const OrderSide = {
  BUY: 'BUY',
  SELL: 'SELL',
} as const;
export type OrderSide = (typeof OrderSide)[keyof typeof OrderSide];

interface OrderBase {
  side: OrderSide;
  size: string;
  type: OrderType;
}

export const OrderType = {
  /** Maker */
  LIMIT: 'LIMIT',
  /** Taker */
  MARKET: 'MARKET',
} as const;
export type OrderType = (typeof OrderType)[keyof typeof OrderType];

export interface CandleImportRequest {
  /** Candle size in milliseconds, i.e. 60000 for 1 minute */
  intervalInMillis: number;
  /** Opening time of first candle (start) in ISO 8601 UTC timezone: '2021-01-15T01:00:00.000Z' */
  startTimeFirstCandle: string;
  /** Opening time of last candle (stop) in ISO 8601 UTC timezone: '2021-01-15T01:59:00.000Z' */
  startTimeLastCandle: string;
}

/**
 * A fee rate of "1" means 100%, "0.1" is 10%, "0.01" is 1%, ...
 *
 * @see https://www.investopedia.com/articles/active-trading/042414/what-makertaker-fees-mean-you.asp
 */
export interface FeeRate {
  /** The maker commission: When you put in a limit order on an exchange that doesn't fill immediately, it adds to the available orders for that stock. To attract more traders, the exchange may offer a lower fee when adding to the order book. */
  LIMIT: Big;
  /** The taker commission: Market orders are usually filled immediately, but they reduce available liquidity on an order book, which isn't good for exchanges. To prevent this, exchanges usually have higher taker fees than maker fees. */
  MARKET: Big;
  /**
   * Per-leg rate charged when the account currency differs from `pair.counter` and the
   * broker auto-converts. Undefined / zero when no conversion happens. The name matches
   * Trading212's tax line `CURRENCY_CONVERSION_FEE` so post-trade fees and pre-trade
   * estimates speak the same vocabulary.
   */
  CURRENCY_CONVERSION_FEE?: Big;
}

export const OrderPosition = {
  LONG: 'LONG',
  SHORT: 'SHORT',
} as const;
export type OrderPosition = (typeof OrderPosition)[keyof typeof OrderPosition];

export interface Fill {
  /** Date in ISO 8601 format */
  created_at: string;
  /** Total fee in fee asset */
  fee: string;
  feeAsset: string;
  order_id: string;
  pair: TradingPair;
  position: OrderPosition;
  price: string;
  side: OrderSide;
  /** Total order size in base currency */
  size: string;
}

/**
 * Base-asset quantity a fill delivered, which is less than `fill.size` when the venue takes its
 * commission out of the asset it credits — Alpaca does this on a crypto BUY. `fill.size` stays the
 * executed quantity because `size × price` is the cost basis.
 */
export function getFilledBaseAmount(fill: Fill): Big {
  const size = new Big(fill.size);

  if (fill.side === OrderSide.BUY && fill.feeAsset === fill.pair.base) {
    return size.minus(fill.fee);
  }

  return size;
}

export interface ExchangePendingOrderBase {
  id: string;
  pair: TradingPair;
  side: OrderSide;
  size: string;
  type: OrderType;
}

export interface PendingLimitOrder extends ExchangePendingOrderBase {
  price: string;
  type: 'LIMIT';
}

export interface PendingMarketOrder extends ExchangePendingOrderBase {
  /** Market orders don't have a price. */
  type: 'MARKET';
  /** When `true`, `size` is a counter-currency (notional) amount, not a base quantity. */
  sizeInCounter?: boolean;
}

/**
 * Example: SHOP/USD
 * - Buy: "sizeInCounter": true with "size": 200 means "I want to buy as much as I can for a total amount of 200 USD (notional)
 * - Sell: "sizeInCounter": true with "size": 200 means "I want to sell as much as possible, so I get 200 USD (notional)
 * - Sell: "sizeInCounter": false with "size": 200 means "I want to sell 200 stocks for whatever is the current price (quantitative)
 * - Buy: "sizeInCounter": false with "size": 200 means "I want to buy 200 stocks for whatever is the current price on the exchange (quantitative)
 */
export interface MarketOrderOptions extends OrderBase {
  sizeInCounter: boolean;

  type: 'MARKET';
}

export interface LimitOrderOptions extends OrderBase {
  price: string;

  sizeInCounter: false;
  type: 'LIMIT';
}

export type OrderOptions = MarketOrderOptions | LimitOrderOptions;

export type PendingOrder = PendingLimitOrder | PendingMarketOrder;

export interface Balance {
  /** How much of the position is available */
  available: string;
  /** Asset/Symbol, Examples: "BTC", "EUR" or "TSLA" */
  currency: string;
  /** How much of the position is in transit (i.e. part of an order that has to be filled) */
  hold: string;
  /** Is it a long or short position? */
  position: OrderPosition;
}

export interface ExchangeAvailableBalance {
  base: Big;
  counter: Big;
}

export interface TradingRules {
  /** Steps in which the quantity can be incremented */
  base_increment: string;
  /** Maximum quantity that can be bought */
  base_max_size: string;
  /** Minimum quantity that can be bought */
  base_min_size: string;
  /** Steps in which the price can be incremented */
  counter_increment: string;
  /** Minimum total price */
  counter_min_size: string;
  pair: TradingPair;
}

export abstract class Broker extends EventEmitter {
  loggerName: string;

  constructor(loggerName: string) {
    super();
    this.loggerName = loggerName;
  }

  /**
   * If there are no recently filled orders, this function can be used to assume if you have recently bought or sold an
   * asset by checking your account balance and current market price.
   *
   * @param baseBalance - Asset (i.e. "TSLA")
   * @param counterBalance - Balance that you used to buy the asset (i.e. "USD")
   * @param priceInCounter - Price of the asset
   */
  static toExchangeOrderSide(
    baseBalance: Big.BigSource,
    counterBalance: Big.BigSource,
    priceInCounter: Big.BigSource
  ): OrderSide {
    const currentBaseWorthInCounter = new Big(baseBalance).mul(priceInCounter);
    const currentCounterWorthInCounter = new Big(counterBalance);
    if (currentBaseWorthInCounter.gt(currentCounterWorthInCounter)) {
      return OrderSide.BUY;
    }
    return OrderSide.SELL;
  }

  /**
   * Lists all positions on your account.
   *
   * Example:
   * [{ available: '548.20', currency: 'EUR', hold: '0.00000000' }]
   */
  abstract listBalances(): Promise<Balance[]>;

  /**
   * Cancel pending orders.
   *
   * @param pair - Trading pair
   * @returns The IDs of all canceled orders
   */
  abstract cancelOpenOrders(pair: TradingPair): Promise<string[]>;

  abstract cancelOrderById(pair: TradingPair, orderId: string): Promise<void>;

  /**
   * Get all open (unfilled) orders for a pair.
   */
  abstract getOpenOrders(pair: TradingPair): Promise<PendingOrder[]>;

  /**
   * Find the last filled order for a pair/symbol.
   */
  async getLatestFill(pair: TradingPair, side: OrderSide): Promise<Fill | undefined> {
    const fills = await this.getFills(pair);
    const fill = fills.find(fill => fill.side === side);

    if (fill) {
      return fill;
    }

    return undefined;
  }

  /**
   * Get all fills. Most recent being the first item in the returned array.
   *
   * @param pair - Trading pair
   */
  abstract getFills(pair: TradingPair): Promise<Fill[]>;

  /**
   * Returns a filled order (merged when an order got split into several fills) and `undefined` if the order is not yet
   * filled.
   *
   * @param pair - Trading pair
   * @param orderId - Order ID to look up
   */
  abstract getFillByOrderId(pair: TradingPair, orderId: string): Promise<Fill | undefined>;

  /**
   * Subscribe to real-time order fill updates via WebSocket.
   * Emits Fill objects via EventEmitter with the returned topicId as the event name.
   *
   * @returns The generated topicId (UUID) for this subscription
   */
  abstract watchOrders(): Promise<string>;

  /**
   * Unsubscribe from real-time order fill updates.
   *
   * @param topicId - The subscription identifier to unsubscribe
   */
  abstract unwatchOrders(topicId: string): void;

  abstract getTradingRules(pair: TradingPair): Promise<TradingRules>;

  /**
   * Returns the trading fees for a specific pair/symbol.
   *
   * @see https://www.investopedia.com/articles/active-trading/042414/what-makertaker-fees-mean-you.asp
   */
  abstract getFeeRates(pair: TradingPair): Promise<FeeRate>;

  /**
   * Returns the fee for a specific type of order.
   */
  async getFeeRate(pair: TradingPair, orderType: OrderType): Promise<Big> {
    const feeRate = await this.getFeeRates(pair);
    return feeRate[orderType];
  }

  /**
   * Estimate the per-leg fee for a single order before placing it. Strategies use this to
   * decide whether an expected price move covers round-trip costs. The estimate combines
   * the order-type commission rate and (when applicable) the currency-conversion rate.
   *
   * `feeAsset` is the currency the fee will actually be debited in — typically the account
   * currency, which can differ from `pair.counter` on cross-currency accounts.
   *
   * Returns the *expected* fee. Actual realised fees come back on `Fill.fee` after the
   * order executes and may differ slightly (broker-side spreads, FX rate variation).
   */
  async estimateFee(
    pair: TradingPair,
    orderType: OrderType,
    notional: Big
  ): Promise<{commission: Big; currencyConversion: Big; total: Big; feeAsset: string}> {
    const rates = await this.getFeeRates(pair);
    const commission = notional.times(rates[orderType]);
    const conversionRate = rates.CURRENCY_CONVERSION_FEE;
    const currencyConversion = conversionRate ? notional.times(conversionRate) : new Big(0);
    return {
      commission,
      currencyConversion,
      feeAsset: await this.getFeeAsset(pair),
      total: commission.plus(currencyConversion),
    };
  }

  /**
   * The price at which closing a position finally clears a profit, once every cost is paid.
   *
   * Which way the bound runs depends on the position: a long needs a *floor* to sell above, a
   * short a *ceiling* to buy back below. The entry's side decides, so one method answers both and
   * neither direction is assumed.
   *
   * A percentage target is not a profit: on a small position the round trip can cost more than
   * the move it is measured against. One share of Ford bought at USD 11.55 cost USD 0.12 to buy
   * and USD 0.12 to sell, so a 1% take-profit at 11.78 would have realised a loss. This answers
   * the question that actually matters — what price makes the exit worth taking.
   *
   * The entry is either an order already filled (side and fees read from the execution) or a
   * hypothetical price and size, which is treated as long unless `side` says otherwise.
   * `minProfit` defaults to one cent, the smallest amount a currency can express.
   *
   * The result is rounded *up* to the instrument's price tick, so it is a placeable limit price.
   * Fees are not proportional — IBKR bills per share with a floor, which no rate can describe —
   * so the price is solved for rather than divided out, then checked against the fee actually
   * quoted at that price.
   *
   * Everything is denominated in `pair.counter`, the currency the price is quoted in, `minProfit`
   * included. A broker that debits fees in another currency (Trading212 bills a EUR account in EUR
   * for a USD instrument) needs `feeToCounterRate` to bring them into that currency; without it
   * the sum would silently mix currencies, so the call fails instead.
   */
  async getProfitableExitPrice(
    pair: TradingPair,
    entry: {orderId: string} | {fee?: Big | string; price: Big | string; side?: OrderSide; size: Big | string},
    options?: {
      /** Multiplier from the fee currency into `pair.counter`, needed only when the two differ. */
      feeToCounterRate?: Big | string;
      minProfit?: Big | string;
      orderType?: OrderType;
    }
  ): Promise<{
    currency: string;
    entryFee: Big;
    /** `BUY` for a long position, `SELL` for a short one. Taken from the fill when resolved by id. */
    entrySide: OrderSide;
    /** A long's total outlay including its fee, or a short's proceeds net of it. */
    entryValue: Big;
    exitFee: Big;
    /** The side that closes the position: `SELL` out of a long, `BUY` back into a short. */
    exitSide: OrderSide;
    minProfit: Big;
    price: Big;
    profit: Big;
  }> {
    const minProfit = new Big(options?.minProfit ?? '0.01');
    const orderType = options?.orderType ?? OrderType.LIMIT;
    const feeAsset = await this.getFeeAsset(pair);
    const currency = pair.counter;

    /*
     * A fee in another currency is not comparable with a price in `pair.counter`, and adding the
     * two would produce a confident but meaningless target. Converting needs a rate this class has
     * no way to look up, so the caller supplies one or gets an error.
     */
    if (feeAsset !== currency && options?.feeToCounterRate === undefined) {
      throw new Error(
        `${this.getName()} debits fees in ${feeAsset} while ${pair.asString('/')} is priced in ${currency}. Pass \`feeToCounterRate\` (${feeAsset}→${currency}) so the fees can be added to the price.`
      );
    }

    const feeRate = new Big(options?.feeToCounterRate ?? 1);
    const resolved = await this.#resolveEntry(pair, entry);
    const entryFee = resolved.fee.mul(feeRate);
    const size = resolved.size;

    if (size.lte(0)) {
      throw new Error(`Cannot price an exit for a position of ${size.toFixed()} ${pair.base}.`);
    }

    const entrySide = resolved.side;
    const isShort = entrySide === OrderSide.SELL;
    const exitSide = isShort ? OrderSide.BUY : OrderSide.SELL;
    const gross = resolved.price.mul(size);

    /*
     * A long paid `gross` plus its fee and has to earn that back; a short already received `gross`
     * less its fee and has to buy back for less than that. So the fee moves the bar the same way
     * in both cases — against the trader — but the price solved for runs in opposite directions.
     */
    const entryValue = isShort ? gross.minus(entryFee) : gross.plus(entryFee);
    const rules = await this.getTradingRules(pair);
    const tick = new Big(rules.counter_increment);

    const priceFor = async (candidate: Big) =>
      (await this.estimateFee(pair, orderType, candidate.mul(size))).total.mul(feeRate);

    /*
     * Fixed-point iteration in both directions: price the fee at the current guess, move the
     * price to cover it, repeat. A step can only change the fee by less than it changes the price,
     * so this settles; the cap stops a broker whose fee grows with price from looping forever.
     */
    const MAX_ROUNDS = 8;
    let exitFee = new Big(0);
    let price: Big;

    if (isShort) {
      /*
       * The most the buy-back may cost, fee included. Rounded *down*: a lower buy price only adds
       * profit, while rounding up would hand back the cent that was being protected.
       */
      const budget = entryValue.minus(minProfit);

      if (budget.lte(0)) {
        throw new Error(
          `Closing this short for a profit of ${minProfit.toFixed()} ${currency} would need a price at or below zero, because the position only took in ${entryValue.toFixed()}.`
        );
      }

      price = Broker.roundToTick(budget.div(size), tick, Big.roundDown);

      for (let round = 0; round < MAX_ROUNDS; round++) {
        exitFee = await priceFor(price);

        if (price.mul(size).plus(exitFee).lte(budget)) {
          break;
        }

        /*
         * The buy-back fee has eaten the whole budget, so no price above zero closes this short
         * for the profit asked. Caught here rather than left to converge, which would otherwise
         * hand back a price of zero or less and look like an answer.
         */
        if (budget.minus(exitFee).lte(0)) {
          throw new Error(
            `Closing this short for a profit of ${minProfit.toFixed()} ${currency} is impossible: the exit fee of ${exitFee.toFixed()} alone exceeds the ${budget.toFixed()} the position has to spend.`
          );
        }

        price = Broker.roundToTick(budget.minus(exitFee).div(size), tick, Big.roundDown);
      }

      if (price.lte(0)) {
        throw new Error(
          `Closing this short for a profit of ${minProfit.toFixed()} ${currency} would need a price of ${price.toFixed()}, which cannot be placed.`
        );
      }
    } else {
      // What the sale has to bring in, the entry's fee and the requested profit included.
      const target = entryValue.plus(minProfit);
      price = Broker.roundToTick(target.div(size), tick, Big.roundUp);

      for (let round = 0; round < MAX_ROUNDS; round++) {
        exitFee = await priceFor(price);
        const needed = Broker.roundToTick(target.plus(exitFee).div(size), tick, Big.roundUp);

        if (needed.lte(price)) {
          break;
        }

        price = needed;
      }
    }

    const exitValue = isShort ? price.mul(size).plus(exitFee) : price.mul(size).minus(exitFee);

    return {
      currency,
      entryFee,
      entrySide,
      entryValue,
      exitFee,
      exitSide,
      minProfit,
      price,
      profit: isShort ? entryValue.minus(exitValue) : exitValue.minus(entryValue),
    };
  }

  /**
   * Snaps a price onto the instrument's tick, since a price between ticks cannot be placed.
   *
   * The direction is the caller's to choose and is never neutral: a long's exit rounds up and a
   * short's rounds down, so that rounding always costs the venue a fraction of a tick rather than
   * eating into the profit the price was solved for.
   */
  protected static roundToTick(price: Big, tick: Big, mode: typeof Big.roundUp | typeof Big.roundDown): Big {
    if (tick.lte(0)) {
      return price;
    }
    return price.div(tick).round(0, mode).mul(tick);
  }

  async #resolveEntry(
    pair: TradingPair,
    entry: {orderId: string} | {fee?: Big | string; price: Big | string; side?: OrderSide; size: Big | string}
  ): Promise<{fee: Big; price: Big; side: OrderSide; size: Big}> {
    if (!('orderId' in entry)) {
      return {
        fee: new Big(entry.fee ?? 0),
        price: new Big(entry.price),
        // A position is long unless stated otherwise, which is the common case.
        side: entry.side ?? OrderSide.BUY,
        size: new Big(entry.size),
      };
    }

    const fill = await this.getFillByOrderId(pair, entry.orderId);

    if (!fill) {
      throw new Error(
        `No fill found for order "${entry.orderId}" on ${pair.asString('/')}, so its cost basis is unknown.`
      );
    }

    /*
     * The fill's own side decides the direction. Reading it is what separates a long from a short:
     * ignoring it prices a short's exit as if the position had been bought, which moves the target
     * the wrong way entirely.
     */
    return {fee: new Big(fill.fee), price: new Big(fill.price), side: fill.side, size: new Big(fill.size)};
  }

  /**
   * The currency in which broker fees are debited. Defaults to `pair.counter`; brokers
   * with cross-currency accounts (e.g. Trading212 EUR account trading USD instruments)
   * override this to return the account currency.
   */
  protected async getFeeAsset(pair: TradingPair) {
    return pair.counter;
  }

  /**
   * Returns the positions that your account is holding on the exchange.
   */
  async getAvailableBalances(pair: TradingPair): Promise<ExchangeAvailableBalance> {
    const balances = await this.listBalances();

    let baseBalance = balances.find(balance => balance.currency === pair.base);
    let counterBalance = balances.find(balance => balance.currency === pair.counter);

    if (!baseBalance) {
      baseBalance = {
        available: '0',
        currency: pair.base,
        hold: '0',
        position: OrderPosition.LONG,
      };
    }

    if (!counterBalance) {
      counterBalance = {
        available: '0',
        currency: pair.counter,
        hold: '0',
        position: OrderPosition.LONG,
      };
    }

    return {
      base: new Big(baseBalance.available),
      counter: new Big(counterBalance.available),
    };
  }

  /**
   * Get the exchange's time in ISO 8601 format. The timezone is always zero UTC offset, as denoted by the suffix "Z",
   * i.e. "2020-09-11T14:04:33.769Z".
   */
  abstract getTime(): Promise<string>;

  /**
   * Proves the configured credentials are authorized by issuing an authenticated network request,
   * so bad keys surface immediately instead of at the first real trade. The default probe is
   * {@link getTime}. Subclasses whose `getTime()` never leaves the process (brokers without a
   * server-time endpoint, e.g. Trading212) MUST override this with a genuinely authenticated call.
   */
  async verifyCredentials(): Promise<void> {
    await this.getTime();
  }

  /**
   * Generic function to place an order.
   * @protected Please use `placeLimitOrder` or `placeMarketOrder`.
   */
  protected abstract placeOrder(pair: TradingPair, options: LimitOrderOptions): Promise<PendingLimitOrder>;
  protected abstract placeOrder(pair: TradingPair, options: MarketOrderOptions): Promise<PendingMarketOrder>;
  protected abstract placeOrder(pair: TradingPair, options: OrderOptions): Promise<PendingOrder>;

  /**
   * Places a LIMIT order.
   * @see https://www.investopedia.com/terms/l/limitorder.asp
   */
  placeLimitOrder(
    pair: TradingPair,
    options: Omit<LimitOrderOptions, 'type' | 'sizeInCounter'>
  ): Promise<PendingLimitOrder> {
    return this.placeOrder(pair, {
      price: options.price,
      side: options.side,
      size: options.size,
      sizeInCounter: false,
      type: OrderType.LIMIT,
    });
  }

  /**
   * Places a MARKET order.
   * @see https://www.investopedia.com/terms/m/marketorder.asp
   */
  placeMarketOrder(pair: TradingPair, options: Omit<MarketOrderOptions, 'type'>): Promise<PendingMarketOrder> {
    return this.placeOrder(pair, {
      side: options.side,
      size: options.size,
      sizeInCounter: options.sizeInCounter,
      type: OrderType.MARKET,
    });
  }

  /**
   * Disconnects the client from any pending connection with the exchange (mostly open WebSockets).
   */
  abstract disconnect(): void;

  /**
   * Returns an identifiable name for the exchange.
   */
  abstract getName(): string;

  /**
   * Get the smallest supported candle interval in milliseconds.
   */
  abstract getSmallestInterval(): number;
}
