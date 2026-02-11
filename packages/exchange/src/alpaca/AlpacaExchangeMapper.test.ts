import {describe, expect, it, vi} from 'vitest';
import {AlpacaExchangeMapper} from './AlpacaExchangeMapper.js';
import minutes5 from '../../fixtures/alpaca/bars/minutes-5.json' with {type: 'json'};
import {AssetClass, OrderSide, OrderStatus, OrderType, TimeInForce} from './api/schema/OrderSchema.js';
import {ms} from 'ms';
import {BatchedCandle} from '../candle/BatchedCandle.js';
import {CandleBatcher} from '../candle/CandleBatcher.js';
import {TradingPair} from '../core/TradingPair.js';
import {ExchangeOrderPosition, ExchangeOrderSide} from '../core/Exchange.js';

describe('AlpacaExchangeMapper', () => {
  describe('mapInterval', () => {
    it('maps milliseconds into Alpaca-specific bar aggregation timeframes', () => {
      expect(() => AlpacaExchangeMapper.mapInterval(ms('1s'))).toThrowError();
      expect(AlpacaExchangeMapper.mapInterval(ms('1m'))).toBe('1Min');
      expect(AlpacaExchangeMapper.mapInterval(ms('7m'))).toBe('7Min');
      expect(AlpacaExchangeMapper.mapInterval(ms('59m'))).toBe('59Min');
      expect(AlpacaExchangeMapper.mapInterval(ms('1h'))).toBe('1Hour');
      expect(AlpacaExchangeMapper.mapInterval(ms('23h'))).toBe('23Hour');
      expect(AlpacaExchangeMapper.mapInterval(ms('1d'))).toBe('1Day');
      expect(() => AlpacaExchangeMapper.mapInterval(ms('2d'))).toThrowError();
    });
  });

  describe('toExchangeCandle', () => {
    it('can batch candles', () => {
      const candleSize = ms('5m');
      const onBatchedCandle = vi.fn().mockImplementation((candle: BatchedCandle) => {
        expect(candle.open.toString()).toBe('178.56');
        expect(candle.close.toString()).toBe('178.635');
        expect(candle.volume.toString()).toBe('102248');
        expect(candle.sizeInMillis).toBe(candleSize);
      });
      const cb = new CandleBatcher(candleSize);
      cb.on('batchedCandle', onBatchedCandle);

      const pair = new TradingPair('AAPL', 'USD');
      const candles = minutes5.map(bar => AlpacaExchangeMapper.toExchangeCandle(bar, pair, ms('1m')));
      candles.forEach(candle => cb.addToBatch(candle));
      expect(onBatchedCandle).toBeCalledTimes(1);
    });
  });

  describe('toFilledOrder', () => {
    it('maps a filled BUY order', () => {
      const order = {
        asset_class: AssetClass.US_EQUITY,
        asset_id: '78856c3d-67c8-43bc-8cd4-e95b686cf741',
        canceled_at: null,
        client_order_id: 'bb5de406-f656-4b51-9e64-03dfda718ff8',
        created_at: '2023-08-21T15:57:26.195019Z',
        expired_at: null,
        extended_hours: false,
        failed_at: null,
        filled_at: '2023-08-21T15:57:26.840459Z',
        filled_avg_price: '53.05',
        filled_qty: '3',
        id: 'b5bb0958-095f-4fa7-8ed5-294d027a9a7d',
        legs: null,
        limit_price: null,
        notional: null,
        qty: '3',
        replaced_at: null,
        replaced_by: null,
        replaces: null,
        side: OrderSide.BUY,
        status: OrderStatus.FILLED,
        stop_price: null,
        submitted_at: '2023-08-21T15:57:26.200646Z',
        symbol: 'SHOP',
        time_in_force: TimeInForce.DAY,
        type: OrderType.MARKET,
        updated_at: '2023-08-21T15:57:26.842893Z',
      } as const;

      const pair = new TradingPair('SHOP', 'USD');

      const filledOrder = AlpacaExchangeMapper.toFilledOrder(order, pair);

      expect(filledOrder.created_at).toBe('2023-08-21T15:57:26.195019Z');
      expect(filledOrder.fee).toBe('0');
      expect(filledOrder.feeAsset).toBe('USD');
      expect(filledOrder.order_id).toBe('b5bb0958-095f-4fa7-8ed5-294d027a9a7d');
      expect(filledOrder.pair).toBe(pair);
      expect(filledOrder.position).toBe(ExchangeOrderPosition.LONG);
      expect(filledOrder.price).toBe('53.05');
      expect(filledOrder.side).toBe(ExchangeOrderSide.BUY);
      expect(filledOrder.size).toBe('3');
    });

    it('does not map a canceled SELL order', () => {
      const order = {
        asset_class: AssetClass.US_EQUITY,
        asset_id: '78856c3d-67c8-43bc-8cd4-e95b686cf741',
        canceled_at: '2023-08-21T20:04:27.624502Z',
        client_order_id: 'c4df8bfb-faef-4608-a4fb-e2f89b2a4697',
        created_at: '2023-08-21T16:01:51.634964Z',
        expired_at: null,
        extended_hours: false,
        failed_at: null,
        filled_at: null,
        filled_avg_price: null,
        filled_qty: '0',
        id: '2d2cb898-9ac4-4bc6-8432-ce2be4271a38',
        legs: null,
        limit_price: '666',
        notional: null,
        qty: '1',
        replaced_at: null,
        replaced_by: null,
        replaces: null,
        side: OrderSide.SELL,
        status: OrderStatus.CANCELED,
        stop_price: null,
        submitted_at: '2023-08-21T16:01:51.651157Z',
        symbol: 'SHOP',
        time_in_force: TimeInForce.DAY,
        type: OrderType.LIMIT,
        updated_at: '2023-08-21T20:04:27.627297Z',
      } as const;

      const pair = new TradingPair('SHOP', 'USD');

      expect(() => AlpacaExchangeMapper.toFilledOrder(order, pair)).toThrowError();
    });
  });
});
