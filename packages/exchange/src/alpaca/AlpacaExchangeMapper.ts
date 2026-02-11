import type {Bar} from './api/schema/BarSchema.js';
import {type Order, OrderStatus} from './api/schema/OrderSchema.js';
import {ms} from 'ms';
import {TradingPair} from '../core/TradingPair.js';
import {
  ExchangeCandle,
  ExchangeFill,
  ExchangeOrderOptions,
  ExchangeOrderPosition,
  ExchangeOrderSide,
  ExchangeOrderType,
  ExchangePendingLimitOrder,
  ExchangePendingMarketOrder,
} from '../core/Exchange.js';

export class AlpacaExchangeMapper {
  static mapInterval(intervalInMillis: number): string {
    if (intervalInMillis < ms('1m')) {
      throw new Error(`Timeframes below 1 minute are not supported.`);
    }

    if (intervalInMillis > ms('1d')) {
      throw new Error(`Timeframes above 1 day are not supported.`);
    }

    return ms(intervalInMillis).replace('m', 'Min').replace('h', 'Hour').replace('d', 'Day');
  }

  static toExchangeCandle(candle: Bar, pair: TradingPair, sizeInMillis: number): ExchangeCandle {
    // Converting "RFC 3339" time to "ISO 8601 UTC" time
    const date = new Date(candle.t);
    return {
      base: pair.base,
      close: candle.c + '',
      counter: pair.counter,
      high: candle.h + '',
      low: candle.l + '',
      open: candle.o + '',
      openTimeInISO: date.toISOString(),
      openTimeInMillis: date.getTime(),
      sizeInMillis: sizeInMillis,
      volume: candle.v + '',
    };
  }

  static toExchangePendingOrder(order: Order, pair: TradingPair, options: ExchangeOrderOptions) {
    if (order.type === 'market') {
      const pendingOrder: ExchangePendingMarketOrder = {
        id: order.id,
        pair,
        side: options.side,
        size: order.notional ? `${order.notional}` : `${order.qty}`,
        type: ExchangeOrderType.MARKET,
      };
      return pendingOrder;
    }
    const pendingOrder: ExchangePendingLimitOrder = {
      id: order.id,
      pair,
      price: `${order.limit_price}`,
      side: options.side,
      size: `${order.qty}`,
      type: ExchangeOrderType.LIMIT,
    };
    return pendingOrder;
  }

  static toFilledOrder(order: Order, pair: TradingPair): ExchangeFill {
    if (order.status !== OrderStatus.FILLED) {
      throw new Error(`Order ID "${order.id}" is not filled.`);
    }

    return {
      created_at: `${order.created_at}`,
      /** Alpaca does not charge a commission (except for crypto) for trades: https://files.alpaca.markets/disclosures/library/BrokFeeSched.pdf */
      fee: '0',
      feeAsset: pair.counter,
      order_id: `${order.id}`,
      pair,
      /** @see https://forum.alpaca.markets/t/13480 */
      position: ExchangeOrderPosition.LONG,
      price: `${order.filled_avg_price}`,
      side: order.side === 'buy' ? ExchangeOrderSide.BUY : ExchangeOrderSide.SELL,
      size: `${order.filled_qty}`,
    };
  }
}
