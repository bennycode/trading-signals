import Big from 'big.js';
import type {TradingPair} from '../TradingPair.js';
import {
  OrderPosition,
  OrderSide,
  OrderType,
  type Balance,
  type Fill,
  type LimitOrderOptions,
  type MarketOrderOptions,
  type OrderOptions,
  type PendingLimitOrder,
  type PendingMarketOrder,
  type PendingOrder,
  type PendingStopLimitOrder,
  type PendingStopOrder,
  type StopLimitOrderOptions,
  type StopOrderOptions,
  type TradingRules,
} from '../Broker.js';
import type {Instrument} from './api/schema/InstrumentSchema.js';
import type {Position} from './api/schema/PositionSchema.js';
import type {HistoryOrder} from './api/schema/HistoryOrderSchema.js';
import type {Order} from './api/schema/OrderSchema.js';
import {Trading212OrderStatus} from './api/schema/OrderSchema.js';

/**
 * Trading212 uses vendor tickers like "AAPL_US_EQ" for equities.
 *
 * Convention: `pair.base` is the Trading212 ticker, `pair.counter` is the instrument's
 * `currencyCode` (e.g. "USD", "EUR"). Resolve via `MetadataAPI.getInstruments()`.
 *
 * Trading212 encodes side in the sign of the size field: positive = BUY, negative = SELL.
 * QUANTITY-strategy orders carry the size in `quantity`/`orderedQuantity`/`filledQuantity`;
 * VALUE-strategy orders (placed via the Trading212 app) carry it in `value`/`orderedValue`/`filledValue`.
 */
export class Trading212BrokerMapper {
  static toPendingOrder(order: Order, pair: TradingPair, options: LimitOrderOptions): PendingLimitOrder;
  static toPendingOrder(order: Order, pair: TradingPair, options: MarketOrderOptions): PendingMarketOrder;
  static toPendingOrder(order: Order, pair: TradingPair, options: StopOrderOptions): PendingStopOrder;
  static toPendingOrder(order: Order, pair: TradingPair, options: StopLimitOrderOptions): PendingStopLimitOrder;
  static toPendingOrder(order: Order, pair: TradingPair, options: OrderOptions): PendingOrder {
    /*
     * We only ever place QUANTITY-strategy orders, so `quantity` is always populated on
     * the response. Never fall back to `value` — that's notional, not base quantity, and
     * would corrupt the neutral `PendingOrder.size` (which is interpreted in base units).
     */
    if (order.quantity == null) {
      throw new Error(`Trading212 returned an order without a quantity (id: ${order.id}).`);
    }
    const size = `${Math.abs(order.quantity)}`;
    if (options.type === OrderType.LIMIT) {
      if (order.limitPrice == null) {
        throw new Error(`Trading212 returned a LIMIT order without a limitPrice (id: ${order.id}).`);
      }
      const limit: PendingLimitOrder = {
        id: `${order.id}`,
        pair,
        price: `${order.limitPrice}`,
        side: options.side,
        size,
        type: OrderType.LIMIT,
      };
      return limit;
    }
    if (options.type === OrderType.STOP || options.type === OrderType.STOP_LIMIT) {
      /*
       * Read back from the response rather than echoed from the request: a venue that rounds the
       * trigger to a tick would otherwise be reported at the price asked for, and the whole point
       * of a protective stop is knowing where it actually sits.
       */
      if (order.stopPrice == null) {
        throw new Error(`Trading212 returned a ${options.type} order without a stopPrice (id: ${order.id}).`);
      }
      if (options.type === OrderType.STOP) {
        const stop: PendingStopOrder = {
          id: `${order.id}`,
          pair,
          side: options.side,
          size,
          stopPrice: `${order.stopPrice}`,
          type: OrderType.STOP,
        };
        return stop;
      }
      if (order.limitPrice == null) {
        throw new Error(`Trading212 returned a STOP_LIMIT order without a limitPrice (id: ${order.id}).`);
      }
      const stopLimit: PendingStopLimitOrder = {
        id: `${order.id}`,
        pair,
        price: `${order.limitPrice}`,
        side: options.side,
        size,
        stopPrice: `${order.stopPrice}`,
        type: OrderType.STOP_LIMIT,
      };
      return stopLimit;
    }
    const market: PendingMarketOrder = {
      id: `${order.id}`,
      pair,
      side: options.side,
      size,
      type: OrderType.MARKET,
    };
    return market;
  }

  static toOpenOrder(order: Order, pair: TradingPair): PendingOrder {
    /*
     * Callers must filter to QUANTITY-strategy orders before reaching this mapper;
     * VALUE-strategy orders store notional in `value`, not base quantity, and there's no
     * neutral representation for them yet. See `Trading212Broker.getOpenOrders`.
     */
    if (order.quantity == null) {
      throw new Error(`Trading212 returned an order without a quantity (id: ${order.id}).`);
    }
    const signedSize = order.quantity;
    const side = signedSize < 0 ? OrderSide.SELL : OrderSide.BUY;
    const size = `${Math.abs(signedSize)}`;

    if (order.type === 'LIMIT') {
      if (order.limitPrice == null) {
        throw new Error(`Trading212 returned a LIMIT order without a limitPrice (id: ${order.id}).`);
      }
      const limit: PendingLimitOrder = {
        id: `${order.id}`,
        pair,
        price: `${order.limitPrice}`,
        side,
        size,
        type: OrderType.LIMIT,
      };
      return limit;
    }

    /*
     * A resting stop reported as a market order would read as an order about to fill at any moment,
     * which is the opposite of what it is, so the trigger is carried through instead of dropped.
     */
    if (order.type === 'STOP' || order.type === 'STOP_LIMIT') {
      if (order.stopPrice == null) {
        throw new Error(`Trading212 returned a ${order.type} order without a stopPrice (id: ${order.id}).`);
      }
      if (order.type === 'STOP') {
        const stop: PendingStopOrder = {
          id: `${order.id}`,
          pair,
          side,
          size,
          stopPrice: `${order.stopPrice}`,
          type: OrderType.STOP,
        };
        return stop;
      }
      if (order.limitPrice == null) {
        throw new Error(`Trading212 returned a STOP_LIMIT order without a limitPrice (id: ${order.id}).`);
      }
      const stopLimit: PendingStopLimitOrder = {
        id: `${order.id}`,
        pair,
        price: `${order.limitPrice}`,
        side,
        size,
        stopPrice: `${order.stopPrice}`,
        type: OrderType.STOP_LIMIT,
      };
      return stopLimit;
    }

    const market: PendingMarketOrder = {
      id: `${order.id}`,
      pair,
      side,
      size,
      type: OrderType.MARKET,
    };
    return market;
  }

  /**
   * Maps a historical order entry (only FILLED entries should be passed in) to a neutral fill.
   *
   * Trading212's history endpoint returns each item as `{order, fill}`. The realised price,
   * timestamp, and fee breakdown live on `fill`/`fill.walletImpact`; `order` carries the side
   * (encoded as the sign of `quantity`) and the status. Trading212 charges 0% commission on
   * equity trades — the non-zero `taxes.quantity` entries are FX-conversion / stamp-duty /
   * PTM-style fees, debited in the **account** currency. Callers must pass the account
   * `currencyCode`; using `pair.counter` (the instrument currency) corrupts P&L for
   * cross-currency accounts.
   */
  static toFilledOrder(item: HistoryOrder, pair: TradingPair, accountCurrency: string): Fill {
    const order = item.order;
    const fill = item.fill;
    if (order.status !== Trading212OrderStatus.FILLED || !fill) {
      throw new Error(`Order ID "${order.id}" is not filled.`);
    }

    const signedQty = fill.quantity ?? order.quantity ?? order.filledQuantity ?? 0;
    const side = signedQty < 0 ? OrderSide.SELL : OrderSide.BUY;
    const fee = (fill.walletImpact?.taxes ?? []).reduce((sum, tax) => sum + Math.abs(tax.quantity ?? 0), 0);

    return {
      created_at: fill.filledAt ?? order.createdAt ?? '',
      fee: `${fee}`,
      feeAsset: accountCurrency,
      order_id: `${order.id}`,
      pair,
      position: OrderPosition.LONG,
      price: `${fill.price ?? 0}`,
      side,
      size: `${Math.abs(signedQty)}`,
    };
  }

  static toBalance(position: Position): Balance {
    return {
      available: new Big(position.quantity).abs().toFixed(),
      currency: position.ticker,
      hold: '0',
      position: position.quantity < 0 ? OrderPosition.SHORT : OrderPosition.LONG,
    };
  }

  static toTradingRules(instrument: Instrument, pair: TradingPair): TradingRules {
    /*
     * Trading212's `minTradeQuantity` is the floor *and* the increment for fractional shares.
     * Use the same non-zero fallback for both — falling back to '0' on `base_min_size` would
     * let computed sizes of zero pass the trading session's min-size guard.
     */
    const minQuantity = `${instrument.minTradeQuantity ?? '0.000000001'}`;
    return {
      base_increment: minQuantity,
      base_max_size: `${instrument.maxOpenQuantity ?? Number.MAX_SAFE_INTEGER}`,
      base_min_size: minQuantity,
      counter_increment: '0.01',
      counter_min_size: '1',
      pair,
    };
  }
}
