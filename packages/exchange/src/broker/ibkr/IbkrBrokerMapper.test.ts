import {describe, expect, it} from 'vitest';
import {OrderPosition, OrderSide, OrderType} from '../Broker.js';
import {TradingPair} from '../TradingPair.js';
import {IbkrBrokerMapper} from './IbkrBrokerMapper.js';

const pair = new TradingPair('AAPL', 'USD');

describe('IbkrBrokerMapper', () => {
  describe('toBalances', () => {
    it('skips the BASE pseudo-currency so balances are not counted twice', () => {
      const balances = IbkrBrokerMapper.toBalances(
        {
          BASE: {cashbalance: 1_100, currency: 'EUR', settledcash: 1_100},
          EUR: {cashbalance: 1_000, currency: 'EUR', settledcash: 1_000},
          USD: {cashbalance: 100, currency: 'USD', settledcash: 100},
        },
        []
      );

      expect(
        balances.map(balance => balance.currency),
        'BASE restates the other entries'
      ).toEqual(['EUR', 'USD']);
    });

    it('reports settled cash as available, because unsettled proceeds cannot fund a purchase', () => {
      const [balance] = IbkrBrokerMapper.toBalances({USD: {cashbalance: 1_000, currency: 'USD', settledcash: 400}}, []);

      expect(balance?.available, 'only settled cash is spendable on a cash account').toBe('400');
      expect(balance?.hold, 'the unsettled remainder is money in transit').toBe('600');
    });

    it('falls back to the cash balance when the venue reports no settled figure', () => {
      const [balance] = IbkrBrokerMapper.toBalances({USD: {cashbalance: 250, currency: 'USD'}}, []);

      expect(balance?.available).toBe('250');
      expect(balance?.hold).toBe('0');
    });

    it('keeps a negative settled difference out of the hold', () => {
      const [balance] = IbkrBrokerMapper.toBalances({USD: {cashbalance: 100, currency: 'USD', settledcash: 150}}, []);

      expect(balance?.hold, 'a negative hold would be noise, not money in transit').toBe('0');
    });

    it('reports a short position with an unsigned size and a SHORT marker', () => {
      const balances = IbkrBrokerMapper.toBalances({}, [{conid: 265598, position: -8, ticker: 'AAPL'}]);

      expect(balances[0]?.available, 'direction belongs in `position`, not in the sign').toBe('8');
      expect(balances[0]?.position).toBe(OrderPosition.SHORT);
    });

    it('omits positions that have been closed out', () => {
      const balances = IbkrBrokerMapper.toBalances({}, [{conid: 265598, position: 0, ticker: 'AAPL'}]);

      expect(balances).toEqual([]);
    });
  });

  describe('toOrderSide', () => {
    it('accepts both the trade and order spellings', () => {
      expect(IbkrBrokerMapper.toOrderSide('B')).toBe(OrderSide.BUY);
      expect(IbkrBrokerMapper.toOrderSide('BUY')).toBe(OrderSide.BUY);
      expect(IbkrBrokerMapper.toOrderSide('S')).toBe(OrderSide.SELL);
      expect(IbkrBrokerMapper.toOrderSide('SELL')).toBe(OrderSide.SELL);
    });

    it('returns undefined for a side it does not recognise', () => {
      expect(IbkrBrokerMapper.toOrderSide('?')).toBeUndefined();
      expect(IbkrBrokerMapper.toOrderSide(null)).toBeUndefined();
    });
  });

  describe('toFill', () => {
    it('labels the fee with the currency the caller supplies', () => {
      const fill = IbkrBrokerMapper.toFill(
        {commission: '0.35', conid: 265598, price: '190.5', side: 'B', size: 10, trade_time_r: 1_700_000_000_000},
        pair,
        'EUR'
      );

      expect(fill?.feeAsset, 'the mapper reports the fee currency it was given, it does not derive one').toBe('EUR');
      expect(fill?.fee).toBe('0.35');
      expect(fill?.side).toBe(OrderSide.BUY);
      expect(fill?.size).toBe('10');
      expect(fill?.created_at).toBe(new Date(1_700_000_000_000).toISOString());
    });

    it('keeps the size unsigned on a sell', () => {
      const fill = IbkrBrokerMapper.toFill(
        {conid: 265598, price: '190.5', side: 'S', size: -10, trade_time_r: 1_700_000_000_000},
        pair,
        'USD'
      );

      expect(fill?.size).toBe('10');
      expect(fill?.side).toBe(OrderSide.SELL);
    });

    it('defaults a missing commission to zero rather than NaN', () => {
      const fill = IbkrBrokerMapper.toFill(
        {conid: 265598, price: '190.5', side: 'B', size: 1, trade_time_r: 1_700_000_000_000},
        pair,
        'USD'
      );

      expect(fill?.fee).toBe('0');
    });
  });

  describe('toPendingOrder', () => {
    it('maps a limit order with its price', () => {
      const order = IbkrBrokerMapper.toPendingOrder(
        {orderId: 42, orderType: 'LMT', price: '185.25', side: 'BUY', totalSize: '5'},
        pair
      );

      expect(order).toEqual({id: '42', pair, price: '185.25', side: OrderSide.BUY, size: '5', type: OrderType.LIMIT});
    });

    it('accepts the spelled-out order type the live-orders endpoint returns', () => {
      const order = IbkrBrokerMapper.toPendingOrder(
        {orderId: 42, orderType: 'Limit', price: '185.25', side: 'BUY', totalSize: '5'},
        pair
      );

      expect(order?.type, 'IBKR spells the type differently per endpoint').toBe(OrderType.LIMIT);
    });

    it('drops order types the neutral enum cannot express', () => {
      const order = IbkrBrokerMapper.toPendingOrder(
        {orderId: 42, orderType: 'STP', price: '180', side: 'SELL', totalSize: '5'},
        pair
      );

      expect(order, 'calling a stop order a market order would lose its trigger price').toBeUndefined();
    });
  });

  describe('isLiveOrder', () => {
    it('keeps working orders and drops terminal ones', () => {
      expect(IbkrBrokerMapper.isLiveOrder({orderId: 1, status: 'Submitted'})).toBe(true);
      expect(IbkrBrokerMapper.isLiveOrder({orderId: 1, status: 'PreSubmitted'})).toBe(true);
      expect(IbkrBrokerMapper.isLiveOrder({orderId: 1, status: 'Filled'})).toBe(false);
      expect(IbkrBrokerMapper.isLiveOrder({orderId: 1, status: 'Cancelled'})).toBe(false);
    });
  });

  describe('isInstrumentTrade', () => {
    it('keeps an instrument fill and drops a funding conversion', () => {
      // The three executions a single Ford buy produced on a EUR account, as IBKR reported them.
      const feed = [
        {conid: 12_087_792, order_description: 'Sold 0.11 @ 1.09868 on IDEALPRO', sec_type: 'CASH', symbol: 'EUR'},
        {conid: 9_599_491, order_description: 'Bot 1 @ 11.55 on NYSE', sec_type: 'STK', symbol: 'F'},
        {conid: 12_087_792, order_description: 'Sold 10.51 @ 1.09872 on IDEALPRO', sec_type: 'CASH', symbol: 'EUR'},
      ];

      expect(
        feed.filter(trade => IbkrBrokerMapper.isInstrumentTrade(trade)).map(trade => trade.symbol),
        'buying USD stock from a EUR balance adds IDEALPRO conversions nobody ordered'
      ).toStrictEqual(['F']);
    });

    it('keeps a trade whose sec_type IBKR omits', () => {
      expect(IbkrBrokerMapper.isInstrumentTrade({symbol: 'F'}), 'a missing sec_type must not discard a real fill').toBe(
        true
      );
    });
  });

  describe('toCandle', () => {
    it('keeps bar prices as they arrive and scales volume by the lot size', () => {
      const candle = IbkrBrokerMapper.toCandle(
        {c: 200, h: 300, l: 50, o: 100, t: 1_700_000_000_000, v: 7},
        pair,
        60_000,
        100
      );

      expect(candle.open).toBe('100');
      expect(candle.close).toBe('200');
      expect(candle.high).toBe('300');
      expect(candle.low).toBe('50');
      expect(candle.volume, 'IBKR counts volume in lots of volumeFactor shares').toBe('700');
      expect(candle.openTimeInMillis).toBe(1_700_000_000_000);
      expect(candle.sizeInMillis).toBe(60_000);
    });

    it('does not apply the response’s price factor to a bar', () => {
      // Ford's session of 2026-11-16, alongside the priceFactor of 100 that IBKR sends with it.
      const candle = IbkrBrokerMapper.toCandle(
        {c: 11.57, h: 11.92, l: 11.48, o: 11.89, t: 1_794_839_400_000, v: 331_210.53},
        pair,
        86_400_000,
        100
      );

      expect(candle.close, 'dividing by priceFactor reported Ford at USD 0.1157 instead of 11.57').toBe('11.57');
      expect(candle.volume, 'the lot count becomes a share count').toBe('33121053');
    });

    it('reads a missing volume as zero', () => {
      const candle = IbkrBrokerMapper.toCandle({c: 190.5, h: 191, l: 189, o: 190, t: 1, v: null}, pair, 60_000, 1);

      expect(candle.close).toBe('190.5');
      expect(candle.volume, 'a missing volume is zero, not NaN').toBe('0');
    });
  });
});
