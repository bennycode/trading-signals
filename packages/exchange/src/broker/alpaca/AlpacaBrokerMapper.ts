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
  PendingStopOrder,
} from '../Broker.js';
import {PositionSide, type Position} from './api/schema/PositionSchema.js';
import type {PostOrderRequest} from './api/AlpacaAPI.js';
import {OrderLifetime, OrderPosition, OrderSide, OrderType} from '../Broker.js';

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
    if (order.type === 'stop') {
      const pendingOrder: PendingStopOrder = {
        id: order.id,
        pair,
        side: options.side,
        size: `${order.qty}`,
        stopPrice: `${order.stop_price}`,
        type: OrderType.STOP,
      };
      return pendingOrder;
    }
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

    if (order.type === 'stop') {
      const pendingOrder: PendingStopOrder = {
        id: order.id,
        pair,
        side,
        size: `${order.qty}`,
        stopPrice: `${order.stop_price}`,
        type: OrderType.STOP,
      };
      return pendingOrder;
    }

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

  /**
   * Alpaca accepts only one validity for some orders, so an explicit {@link OrderLifetime} it
   * cannot honour is refused instead of quietly downgraded — a caller that asked for a resting
   * order and silently got one expiring at the close has no way to notice.
   *
   * Crypto orders cannot use 'day' and must be placed with 'gtc' (error code: 42210000).
   * Stock fractional and notional orders must use 'day' (error code: 42210000), whole share orders
   * can use either. A fractional stop is refused with 'gtc' too ("stop/stop_limit fractional GTC
   * orders are not enabled").
   *
   * @see https://docs.alpaca.markets/docs/fractional-trading
   */
  private static toTimeInForce(
    lifetime: OrderLifetime | undefined,
    isCrypto: boolean,
    isFractional: boolean
  ): 'day' | 'gtc' {
    if (isCrypto) {
      if (lifetime === OrderLifetime.SESSION) {
        throw new Error('Alpaca rejects day validity for crypto orders, so SESSION cannot be honoured.');
      }
      return 'gtc';
    }

    if (isFractional) {
      if (lifetime === OrderLifetime.UNTIL_CANCELLED) {
        throw new Error(
          'Alpaca accepts a fractional or notional order only with day validity, so UNTIL_CANCELLED cannot be honoured. Send a whole-share size instead.'
        );
      }
      return 'day';
    }

    return lifetime === OrderLifetime.SESSION ? 'day' : 'gtc';
  }

  static toOrderRequest(
    options: OrderOptions,
    symbol: string,
    isCrypto: boolean,
    clientOrderId: string
  ): PostOrderRequest {
    const isFractional = options.sizeInCounter || options.size.includes('.');
    const lifetime = 'lifetime' in options ? options.lifetime : undefined;
    const time_in_force = AlpacaBrokerMapper.toTimeInForce(lifetime, isCrypto, isFractional);

    const base = {
      client_order_id: clientOrderId,
      side: options.side === OrderSide.BUY ? 'buy' : 'sell',
      symbol,
      time_in_force,
      ...(options.sizeInCounter ? {notional: options.size} : {qty: options.size}),
    };

    if (options.type === OrderType.STOP) {
      return {...base, stop_price: options.stopPrice, type: 'stop'};
    }

    if (options.type === OrderType.LIMIT) {
      return {
        ...base,
        limit_price: options.price,
        type: 'limit',
        // @see https://docs.alpaca.markets/docs/orders-at-alpaca#submitting-an-extended-hours-eligible-order
        ...(time_in_force === 'day' ? {extended_hours: true} : {}),
      };
    }

    return {...base, type: 'market'};
  }
}
