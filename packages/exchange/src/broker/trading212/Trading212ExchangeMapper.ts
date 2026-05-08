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
export class Trading212ExchangeMapper {
  static toExchangePendingOrder(
    order: Order,
    pair: TradingPair,
    options: LimitOrderOptions
  ): PendingLimitOrder;
  static toExchangePendingOrder(
    order: Order,
    pair: TradingPair,
    options: MarketOrderOptions
  ): PendingMarketOrder;
  static toExchangePendingOrder(order: Order, pair: TradingPair, options: OrderOptions): PendingOrder {
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
   * Trading212 charges 0% commission on equity trades; the non-zero amounts in `taxes` are
   * FX-conversion / stamp-duty / PTM-style fees, all debited in the **account** currency
   * (Trading212 has no per-tax currency field). Callers must pass the account `currencyCode`
   * — using `pair.counter` (the instrument currency) silently corrupts P&L for cross-currency
   * accounts.
   */
  static toFilledOrder(order: HistoryOrder, pair: TradingPair, accountCurrency: string): Fill {
    if (order.status !== Trading212OrderStatus.FILLED) {
      throw new Error(`Order ID "${order.id}" is not filled.`);
    }

    const signedOrdered = order.orderedQuantity ?? order.orderedValue ?? 0;
    const signedFilled = order.filledQuantity ?? order.filledValue ?? 0;
    const side = signedOrdered < 0 ? OrderSide.SELL : OrderSide.BUY;
    const fee = (order.taxes ?? []).reduce((sum, tax) => sum + (tax.quantity ?? 0), 0);

    return {
      created_at: order.dateExecuted ?? order.dateCreated ?? '',
      fee: `${fee}`,
      feeAsset: accountCurrency,
      order_id: `${order.id}`,
      pair,
      position: OrderPosition.LONG,
      price: `${order.fillPrice ?? 0}`,
      side,
      size: `${Math.abs(signedFilled)}`,
    };
  }
}
