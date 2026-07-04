import Big from 'big.js';
import type {Bar} from './api/schema/BarSchema.js';
import {type Order, AlpacaOrderStatus, type AlpacaAssetClass} from './api/schema/OrderSchema.js';
import {ms} from 'ms';
import {TradingPair} from '../TradingPair.js';
import type {
  Candle,
  FeeRate,
  Fill,
  OrderOptions,
  PendingLimitOrder,
  PendingMarketOrder,
  PendingOrder,
} from '../Broker.js';
import {OrderPosition, OrderSide, OrderType} from '../Broker.js';

export class AlpacaBrokerMapper {
  static mapInterval(intervalInMillis: number) {
    if (intervalInMillis < ms('1m')) {
      throw new Error(`Timeframes below 1 minute are not supported.`);
    }

    if (intervalInMillis > ms('1d')) {
      throw new Error(`Timeframes above 1 day are not supported.`);
    }

    return ms(intervalInMillis).replace('m', 'Min').replace('h', 'Hour').replace('d', 'Day');
  }

  static toCandle(candle: Bar, pair: TradingPair, sizeInMillis: number): Candle {
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

  static toPendingOrder(order: Order, pair: TradingPair, options: OrderOptions) {
    if (order.type === 'market') {
      const pendingOrder: PendingMarketOrder = {
        id: order.id,
        pair,
        side: options.side,
        size: order.notional ? `${order.notional}` : `${order.qty}`,
        type: OrderType.MARKET,
      };
      return pendingOrder;
    }
    const pendingOrder: PendingLimitOrder = {
      id: order.id,
      pair,
      price: `${order.limit_price}`,
      side: options.side,
      size: `${order.qty}`,
      type: OrderType.LIMIT,
    };
    return pendingOrder;
  }

  /**
   * Converts an Alpaca symbol and asset class back into a TradingPair.
   * Crypto symbols use "/" delimiter (e.g., "BTC/USD"), stocks are just the ticker (e.g., "AAPL").
   */
  static symbolToPair(symbol: string, assetClass: AlpacaAssetClass): TradingPair {
    if (assetClass === 'crypto') {
      return TradingPair.fromString(symbol, '/');
    }
    return new TradingPair(symbol, 'USD');
  }

  static toOpenOrder(order: Order, pair: TradingPair): PendingOrder {
    const side = order.side === 'buy' ? OrderSide.BUY : OrderSide.SELL;

    if (order.type === 'market') {
      const pendingOrder: PendingMarketOrder = {
        id: order.id,
        pair,
        side,
        size: order.notional ? `${order.notional}` : `${order.qty}`,
        type: OrderType.MARKET,
      };
      return pendingOrder;
    }

    const pendingOrder: PendingLimitOrder = {
      id: order.id,
      pair,
      price: `${order.limit_price}`,
      side,
      size: `${order.qty}`,
      type: OrderType.LIMIT,
    };
    return pendingOrder;
  }

  static toFilledOrder(order: Order, pair: TradingPair, feeRates: FeeRate): Fill {
    if (order.status !== AlpacaOrderStatus.FILLED) {
      throw new Error(`Order ID "${order.id}" is not filled.`);
    }

    if (order.filled_avg_price === null) {
      throw new Error(`Order ID "${order.id}" is filled but has no average fill price.`);
    }

    const side = order.side === 'buy' ? OrderSide.BUY : OrderSide.SELL;

    /*
     * Alpaca's order payload carries no fee field, so the realized fee has to be derived here.
     * Stocks/ETFs are commission-free, but crypto is not: Alpaca deducts the fee from the
     * credited asset (what you receive) per trade — a BUY pays in the base asset, a SELL pays
     * in the counter/fiat. Limit orders are billed at the maker rate; every other order type
     * removes liquidity and is billed at the taker (market) rate.
     *
     * @see https://docs.alpaca.markets/docs/crypto-fees
     * @see https://files.alpaca.markets/disclosures/library/BrokFeeSched.pdf
     */
    let fee = '0';
    let feeAsset = pair.counter;

    if (order.asset_class === 'crypto') {
      const feeRate = order.type === 'limit' ? feeRates.LIMIT : feeRates.MARKET;
      const filledQty = new Big(order.filled_qty);
      if (side === OrderSide.BUY) {
        fee = filledQty.times(feeRate).toFixed();
        feeAsset = pair.base;
      } else {
        fee = filledQty.times(order.filled_avg_price).times(feeRate).toFixed();
        feeAsset = pair.counter;
      }
    }

    return {
      created_at: `${order.created_at}`,
      fee,
      feeAsset,
      order_id: `${order.id}`,
      pair,
      /**
       * Alpaca's order payload has no position side — from the order alone, a SELL that closes
       * a long is indistinguishable from one that opens a short (https://forum.alpaca.markets/t/13480).
       * This integration only trades long, so every fill is reported as LONG.
       */
      position: OrderPosition.LONG,
      price: order.filled_avg_price,
      side,
      size: `${order.filled_qty}`,
    };
  }
}
