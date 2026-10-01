import type {Bar} from './api/schema/BarSchema.js';
import {type Order, AlpacaOrderStatus, type AlpacaAssetClass} from './api/schema/OrderSchema.js';
import {ms} from 'ms';
import {TradingPair} from '../TradingPair.js';
import Big from 'big.js';
import type {
  Balance,
  Candle,
  Fill,
  OrderOptions,
  PendingLimitOrder,
  PendingMarketOrder,
  PendingOrder,
} from '../Broker.js';
import {PositionSide, type Position} from './api/schema/PositionSchema.js';
import type {AlpacaAPI} from './api/AlpacaAPI.js';
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

  static toFilledOrder(order: Order, pair: TradingPair): Fill {
    if (order.status !== AlpacaOrderStatus.FILLED) {
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
      position: OrderPosition.LONG,
      price: `${order.filled_avg_price}`,
      side: order.side === 'buy' ? OrderSide.BUY : OrderSide.SELL,
      size: `${order.filled_qty}`,
    };
  }

  /**
   * Note: The quantity of a position is negative (i.e. -100) if it is a SHORT position.
   */
  static toBalance(position: Position): Balance {
    // A USDT/USD symbol is returned as "USDTUSD" on Alpaca, so we have to adjust this
    const needsTrimming = position.asset_class === 'crypto' && position.symbol.endsWith('USD');
    const currency = needsTrimming ? position.symbol.replace(/USD$/, '') : position.symbol;

    if (position.side !== PositionSide.LONG && position.side !== PositionSide.SHORT) {
      throw new Error(`Unknown position side "${position.side}" for symbol "${position.symbol}"`);
    }

    return {
      // We are using absolute values here to have positive quantity for SHORT positions
      available: new Big(position.qty).abs().toFixed(),
      currency,
      hold: '0',
      position: position.side === PositionSide.LONG ? OrderPosition.LONG : OrderPosition.SHORT,
    };
  }

  static toOrderRequest(
    options: OrderOptions,
    symbol: string,
    isCrypto: boolean,
    clientOrderId: string
  ): Parameters<AlpacaAPI['postOrder']>[0] {
    /*
     * Crypto orders cannot use 'day' and must be placed with 'gtc' (error code: 42210000)
     * Stock fractional and notional orders must use 'day' (error code: 42210000), whole share orders can use 'gtc'
     * @see https://docs.alpaca.markets/docs/fractional-trading
     */
    const isFractional = options.sizeInCounter || options.size.includes('.');
    const time_in_force = isCrypto || !isFractional ? 'gtc' : 'day';
    const isLimit = options.type === OrderType.LIMIT;

    return {
      client_order_id: clientOrderId,
      side: options.side === OrderSide.BUY ? 'buy' : 'sell',
      symbol,
      time_in_force,
      type: isLimit ? 'limit' : 'market',
      ...(options.sizeInCounter ? {notional: options.size} : {qty: options.size}),
      ...(isLimit ? {limit_price: options.price} : {}),
      // @see https://docs.alpaca.markets/docs/orders-at-alpaca#submitting-an-extended-hours-eligible-order
      ...(isLimit && time_in_force === 'day' ? {extended_hours: true} : {}),
    };
  }
}
