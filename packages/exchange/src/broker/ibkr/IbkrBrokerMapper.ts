import Big from 'big.js';
import {
  OrderPosition,
  OrderSide,
  OrderType,
  type Balance,
  type Candle,
  type Fill,
  type PendingOrder,
} from '../Broker.js';
import type {TradingPair} from '../TradingPair.js';
import {IBKR_LEDGER_BASE_KEY, type IbkrLedger, type IbkrPosition} from './api/schema/AccountSchema.js';
import type {IbkrBar} from './api/schema/BarSchema.js';
import {IBKR_LIVE_ORDER_STATUSES, IbkrOrderType, type IbkrLiveOrder} from './api/schema/OrderSchema.js';
import {IBKR_FX_SEC_TYPE, type IbkrTrade} from './api/schema/TradeSchema.js';

/** IBKR sends most numbers as strings, and omits them rather than sending zero. */
function toBig(value: string | number | null | undefined, fallback = '0'): Big {
  if (value === null || value === undefined || value === '') {
    return new Big(fallback);
  }
  return new Big(value);
}

/**
 * Translates IBKR's wire format into the package's broker-neutral types.
 */
export class IbkrBrokerMapper {
  /**
   * Cash per currency plus one entry per held instrument.
   *
   * `available` comes from `settledcash` rather than `cashbalance`: on a cash account
   * (`STKCASH`) unsettled sale proceeds show up in the balance but cannot fund a purchase, so
   * quoting them as available gets orders rejected at submission. The difference between the two
   * is money in transit, which is what `hold` means.
   */
  static toBalances(ledger: IbkrLedger, positions: IbkrPosition[]): Balance[] {
    const balances: Balance[] = [];

    for (const [key, entry] of Object.entries(ledger)) {
      // `BASE` restates every other entry in the account currency, so counting it double-counts.
      if (key === IBKR_LEDGER_BASE_KEY) {
        continue;
      }

      const cashBalance = toBig(entry.cashbalance);
      const settledCash =
        entry.settledcash === null || entry.settledcash === undefined ? cashBalance : toBig(entry.settledcash);
      const unsettled = cashBalance.minus(settledCash);

      balances.push({
        available: settledCash.toString(),
        currency: entry.currency ?? key,
        // Unsettled proceeds can go negative on a margin account; a negative hold would be noise.
        hold: unsettled.gt(0) ? unsettled.toString() : '0',
        position: OrderPosition.LONG,
      });
    }

    for (const position of positions) {
      const size = new Big(position.position);
      if (size.eq(0)) {
        continue;
      }
      const currency = position.ticker ?? position.contractDesc;
      if (!currency) {
        continue;
      }
      balances.push({
        available: size.abs().toString(),
        currency,
        hold: '0',
        // IBKR encodes a short as a negative quantity; the neutral type keeps size unsigned.
        position: size.lt(0) ? OrderPosition.SHORT : OrderPosition.LONG,
      });
    }

    return balances;
  }

  /**
   * IBKR reports the side as `B`/`S` on trades and `BUY`/`SELL` on orders.
   */
  static toOrderSide(side: string | null | undefined): OrderSide | undefined {
    const normalized = side?.toUpperCase();
    if (normalized === 'B' || normalized === 'BUY') {
      return OrderSide.BUY;
    }
    if (normalized === 'S' || normalized === 'SELL' || normalized === 'SLD') {
      return OrderSide.SELL;
    }
    return undefined;
  }

  /**
   * A single execution. IBKR reports `commission` as a bare number with no currency, so the
   * caller supplies the `feeAsset` it belongs to — see {@link IbkrBroker.getFeeAsset}, which bills
   * a US stock in USD even from a EUR account.
   */
  static toFill(trade: IbkrTrade, pair: TradingPair, feeAsset: string): Fill | undefined {
    const side = IbkrBrokerMapper.toOrderSide(trade.side);
    if (!side) {
      return undefined;
    }

    /*
     * `trade_time_r` only. `trade_time` is a display string like `20261117-11:30:00`, which
     * `Date` cannot parse: it yields an Invalid Date and `toISOString` then throws a RangeError,
     * taking down `getFills` — or, in the fill watcher, getting swallowed after the execution was
     * already marked seen, which drops the fill for good. It is also in the account's timezone,
     * which nothing here knows, so the clock is a safer fallback than a guessed offset.
     */
    const createdAt = new Date(trade.trade_time_r ?? Date.now()).toISOString();

    return {
      created_at: createdAt,
      fee: toBig(trade.commission).toString(),
      feeAsset,
      order_id: trade.order_id === null || trade.order_id === undefined ? '' : String(trade.order_id),
      pair,
      position: OrderPosition.LONG,
      price: toBig(trade.price).toString(),
      side,
      size: toBig(trade.size).abs().toString(),
    };
  }

  /**
   * Open orders. Types outside the neutral enum (stops, trailing stops, brackets) are dropped
   * rather than downgraded: calling a stop order a market order would lose its trigger price and
   * misreport what is working on the account.
   */
  static toPendingOrder(order: IbkrLiveOrder, pair: TradingPair): PendingOrder | undefined {
    const side = IbkrBrokerMapper.toOrderSide(order.side);
    if (!side) {
      return undefined;
    }

    const id = String(order.orderId);
    const size = toBig(order.totalSize ?? order.remainingQuantity)
      .abs()
      .toString();

    /*
     * `orderType` is a display string ("Limit", "LMT", "Market", …) that varies by endpoint and
     * locale, so it is matched case-insensitively against both spellings rather than compared
     * for equality with one of them.
     */
    const orderType = order.orderType?.toUpperCase() ?? '';

    if (orderType === IbkrOrderType.LIMIT || orderType === 'LIMIT') {
      return {id, pair, price: toBig(order.price).toString(), side, size, type: OrderType.LIMIT};
    }

    if (orderType === IbkrOrderType.MARKET || orderType === 'MARKET') {
      return {id, pair, side, size, type: OrderType.MARKET};
    }

    return undefined;
  }

  /** IBKR keeps filled and cancelled orders in the same list as the working ones. */
  static isLiveOrder(order: IbkrLiveOrder): boolean {
    return IBKR_LIVE_ORDER_STATUSES.has(order.status ?? '');
  }

  /**
   * Whether an execution is an instrument trade rather than a currency conversion.
   *
   * Funding a USD order from a EUR balance makes IBKR sell EUR on IDEALPRO, and those `CASH`
   * executions arrive in the same trades feed as the order's own fill. Verified on a live EUR
   * account buying one Ford share: the feed held `Bot 1 F @ 11.55 on NYSE` alongside
   * `Sold 10.51 EUR @ 1.09872 on IDEALPRO` for the notional and another for the commission.
   * Emitting those as fills would have a strategy book conversions it never ordered.
   */
  static isInstrumentTrade(trade: IbkrTrade): boolean {
    return trade.sec_type !== IBKR_FX_SEC_TYPE;
  }

  /**
   * A bar's `o/h/l/c` are already currency amounts and must not be touched by the response's
   * `priceFactor`, which only decodes the `high`/`low` summary strings — dividing by it reported
   * Ford at USD 0.1157 instead of USD 11.57. `volumeFactor` does apply to `v`, which IBKR counts
   * in lots.
   */
  static toCandle(bar: IbkrBar, pair: TradingPair, intervalInMillis: number, volumeFactor: number): Candle {
    return {
      base: pair.base,
      close: String(bar.c),
      counter: pair.counter,
      high: String(bar.h),
      low: String(bar.l),
      open: String(bar.o),
      openTimeInISO: new Date(bar.t).toISOString(),
      openTimeInMillis: bar.t,
      sizeInMillis: intervalInMillis,
      volume: bar.v === null || bar.v === undefined ? '0' : new Big(bar.v).mul(volumeFactor).toString(),
    };
  }
}
