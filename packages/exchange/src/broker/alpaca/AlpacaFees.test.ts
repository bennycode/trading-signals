import Big from 'big.js';
import {describe, expect, it} from 'vitest';
import {OrderSide, OrderType, type FeeRate} from '../Broker.js';
import {TradingPair} from '../TradingPair.js';
import {getCreditedAsset, getTradeCost} from './AlpacaFees.js';

const RATES: FeeRate = {
  [OrderType.LIMIT]: new Big(0.0015),
  [OrderType.MARKET]: new Big(0.0025),
};

const BTC_USD = new TradingPair('BTC', 'USD');

describe('AlpacaFees', () => {
  describe('getCreditedAsset', () => {
    it('credits the base asset on a crypto BUY', () => {
      expect(getCreditedAsset(BTC_USD, OrderSide.BUY, true)).toBe('BTC');
    });

    it('credits the counter asset on a crypto SELL', () => {
      expect(getCreditedAsset(BTC_USD, OrderSide.SELL, true)).toBe('USD');
    });

    it('credits the counter asset for stocks on both sides', () => {
      const pair = new TradingPair('SHOP', 'USD');
      expect(getCreditedAsset(pair, OrderSide.BUY, false)).toBe('USD');
      expect(getCreditedAsset(pair, OrderSide.SELL, false)).toBe('USD');
    });
  });

  describe('getTradeCost', () => {
    it('charges no commission on stocks', () => {
      const cost = getTradeCost({
        isCrypto: false,
        orderType: OrderType.MARKET,
        pair: new TradingPair('SHOP', 'USD'),
        price: '53.05',
        quantity: '3',
        rates: RATES,
        side: OrderSide.BUY,
      });

      expect(cost.fee.toFixed(), 'stocks and ETFs are commission-free on Alpaca').toBe('0');
      expect(cost.feeAsset).toBe('USD');
    });

    it('charges a crypto BUY in the base asset at the taker rate', () => {
      const cost = getTradeCost({
        isCrypto: true,
        orderType: OrderType.MARKET,
        pair: BTC_USD,
        price: '61234.5',
        quantity: '2.5',
        rates: RATES,
        side: OrderSide.BUY,
      });

      expect(cost.fee.toFixed(), '2.5 BTC * 0.0025 taker rate').toBe('0.00625');
      expect(cost.feeAsset).toBe('BTC');
    });

    it('charges a crypto SELL in the counter asset at the maker rate for limit orders', () => {
      const cost = getTradeCost({
        isCrypto: true,
        orderType: OrderType.LIMIT,
        pair: BTC_USD,
        price: '61234.5',
        quantity: '0.4',
        rates: RATES,
        side: OrderSide.SELL,
      });

      expect(cost.fee.toFixed(), '0.4 * 61234.5 USD * 0.0015 maker rate').toBe('36.75');
      expect(cost.feeAsset).toBe('USD');
    });

    it('rounds a fiat fee up to the penny, the way Alpaca bills it', () => {
      /*
       * Taken from a live account: a USDT/USD market SELL of 56.7732 @ 0.99912 has a notional of
       * 56.723239584 USD, which at the 0.25% taker rate computes to 0.14180809896 USD. Alpaca
       * billed a CFEE activity of 0.15 USD for it.
       */
      const cost = getTradeCost({
        isCrypto: true,
        orderType: OrderType.MARKET,
        pair: new TradingPair('USDT', 'USD'),
        price: '0.99912',
        quantity: '56.7732',
        rates: RATES,
        side: OrderSide.SELL,
      });

      expect(cost.fee.toFixed(), 'matches the CFEE activity Alpaca actually charged').toBe('0.15');
      expect(cost.feeAsset).toBe('USD');
    });
  });
});
