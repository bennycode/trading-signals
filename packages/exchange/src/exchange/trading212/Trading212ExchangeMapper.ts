import {TradingPair} from '../TradingPair.js';
import {
  ExchangeOrderPosition,
  ExchangeOrderSide,
  ExchangeOrderType,
  type ExchangeFill,
  type ExchangeLimitOrderOptions,
  type ExchangeMarketOrderOptions,
  type ExchangeOrderOptions,
  type ExchangePendingLimitOrder,
  type ExchangePendingMarketOrder,
  type ExchangePendingOrder,
} from '../Exchange.js';
import type {HistoryOrder} from './api/schema/HistoryOrderSchema.js';
import type {Order} from './api/schema/OrderSchema.js';
import {Trading212OrderStatus} from './api/schema/OrderSchema.js';

/**
 * Trading212 uses vendor tickers like "AAPL_US_EQ" for equities.
 *
 * Convention: `pair.base` is the Trading212 ticker, `pair.counter` is the instrument's
 * `currencyCode` (e.g. "USD", "EUR"). Resolve via `MetadataAPI.getInstruments()`.
 */
export class Trading212ExchangeMapper {
  static toExchangePendingOrder(
    order: Order,
    pair: TradingPair,
    options: ExchangeLimitOrderOptions
  ): ExchangePendingLimitOrder;
  static toExchangePendingOrder(
    order: Order,
    pair: TradingPair,
    options: ExchangeMarketOrderOptions
  ): ExchangePendingMarketOrder;
  static toExchangePendingOrder(order: Order, pair: TradingPair, options: ExchangeOrderOptions): ExchangePendingOrder {
    if (options.type === ExchangeOrderType.LIMIT) {
      const limit: ExchangePendingLimitOrder = {
        id: `${order.id}`,
        pair,
        price: `${order.limitPrice}`,
        side: options.side,
        size: `${order.quantity ?? order.value}`,
        type: ExchangeOrderType.LIMIT,
      };
      return limit;
    }
    const market: ExchangePendingMarketOrder = {
      id: `${order.id}`,
      pair,
      side: options.side,
      size: `${order.quantity ?? order.value}`,
      type: ExchangeOrderType.MARKET,
    };
    return market;
  }

  static toOpenOrder(order: Order, pair: TradingPair): ExchangePendingOrder {
    const quantity = order.quantity ?? 0;
    const side = quantity < 0 ? ExchangeOrderSide.SELL : ExchangeOrderSide.BUY;

    if (order.type === 'LIMIT') {
      const limit: ExchangePendingLimitOrder = {
        id: `${order.id}`,
        pair,
        price: `${order.limitPrice}`,
        side,
        size: `${Math.abs(order.quantity ?? 0)}`,
        type: ExchangeOrderType.LIMIT,
      };
      return limit;
    }

    const market: ExchangePendingMarketOrder = {
      id: `${order.id}`,
      pair,
      side,
      size: `${Math.abs(order.quantity ?? 0)}`,
      type: ExchangeOrderType.MARKET,
    };
    return market;
  }

  /**
   * Maps a historical order entry (only FILLED entries should be passed in) to a neutral fill.
   * Trading212 charges no commission on equity trades; FX conversion fees are included in `taxes`.
   */
  static toFilledOrder(order: HistoryOrder, pair: TradingPair): ExchangeFill {
    if (order.status !== Trading212OrderStatus.FILLED) {
      throw new Error(`Order ID "${order.id}" is not filled.`);
    }

    const orderedQty = order.orderedQuantity ?? 0;
    const filledQty = order.filledQuantity ?? 0;
    const side = orderedQty < 0 ? ExchangeOrderSide.SELL : ExchangeOrderSide.BUY;
    const fee = (order.taxes ?? []).reduce((sum, tax) => sum + (tax.quantity ?? 0), 0);

    return {
      created_at: order.dateExecuted ?? order.dateCreated ?? '',
      fee: `${fee}`,
      feeAsset: pair.counter,
      order_id: `${order.id}`,
      pair,
      position: ExchangeOrderPosition.LONG,
      price: `${order.fillPrice ?? 0}`,
      side,
      size: `${Math.abs(filledQty)}`,
    };
  }
}
