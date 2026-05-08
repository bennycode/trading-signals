import {TradingPair} from '../TradingPair.js';
import {
  OrderPosition,
  OrderSide,
  OrderType,
  type Fill,
  type LimitOrderOptions,
  type MarketOrderOptions,
  type OrderOptions,
  type PendingLimitOrder,
  type PendingMarketOrder,
  type PendingOrder,
} from '../Broker.js';
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
  static toPendingOrder(
    order: Order,
    pair: TradingPair,
    options: LimitOrderOptions
  ): PendingLimitOrder;
  static toPendingOrder(
    order: Order,
    pair: TradingPair,
    options: MarketOrderOptions
  ): PendingMarketOrder;
  static toPendingOrder(order: Order, pair: TradingPair, options: OrderOptions): PendingOrder {
    const size = `${Math.abs(order.quantity ?? order.value ?? 0)}`;
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
    const signedSize = order.quantity ?? order.value ?? 0;
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
}
