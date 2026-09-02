import Big from 'big.js';
import {describe, expect, it} from 'vitest';
import {OrderSide, OrderType, type FeeRate} from '../Broker.js';
import {TradingPair} from '../TradingPair.js';
import {getCreditedAsset, getRegulatoryFee, getTradeCost} from './AlpacaFees.js';

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
        tradedAt: '2026-06-11T15:00:00Z',
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
        tradedAt: '2026-06-11T15:00:00Z',
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
        tradedAt: '2026-06-11T15:00:00Z',
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
        tradedAt: '2026-06-11T15:00:00Z',
      });

      expect(cost.fee.toFixed(), 'matches the CFEE activity Alpaca actually charged').toBe('0.15');
      expect(cost.feeAsset).toBe('USD');
    });

    it('reports the counter-currency equivalent of a base-denominated fee', () => {
      const cost = getTradeCost({
        isCrypto: true,
        orderType: OrderType.MARKET,
        pair: BTC_USD,
        price: '61234.5',
        quantity: '2.5',
        rates: RATES,
        side: OrderSide.BUY,
        tradedAt: '2026-06-11T15:00:00Z',
      });

      expect(cost.fee.toFixed(), 'debited in BTC').toBe('0.00625');
      expect(cost.feeInCounter.toFixed(), '2.5 * 61234.5 USD * 0.0025, rounded up to the penny').toBe('382.72');
      expect(
        cost.fee.times('61234.5').round(2, Big.roundUp).toFixed(),
        'both denominations describe the same fee at the fill price'
      ).toBe(cost.feeInCounter.toFixed());
    });

    it('bills BUY and SELL at the same fraction of the notional', () => {
      const shared = {
        isCrypto: true,
        orderType: OrderType.MARKET,
        pair: BTC_USD,
        price: '61234.5',
        rates: RATES,
        tradedAt: '2026-06-11T15:00:00Z',
      };

      const buy = getTradeCost({...shared, quantity: '2.5', side: OrderSide.BUY});
      const sell = getTradeCost({...shared, quantity: '2.5', side: OrderSide.SELL});

      expect(buy.feeInCounter.toFixed(), 'only the denomination differs between sides, not the rate').toBe(
        sell.feeInCounter.toFixed()
      );
    });

    it('charges regulatory fees on a stock SELL', () => {
      const cost = getTradeCost({
        isCrypto: false,
        orderType: OrderType.MARKET,
        pair: new TradingPair('SHOP', 'USD'),
        price: '100',
        quantity: '10',
        rates: RATES,
        side: OrderSide.SELL,
        tradedAt: '2026-06-11T15:00:00Z',
      });

      expect(cost.fee.toFixed(), '1000 * 0.0000206 SEC + 10 * 0.000166 TAF').toBe('0.02226');
      expect(cost.feeAsset).toBe('USD');
    });
  });

  describe('getRegulatoryFee', () => {
    const sell = (proceeds: string, quantity: string, tradedAt: string) =>
      getRegulatoryFee({proceeds, quantity, side: OrderSide.SELL, tradedAt});

    it('charges nothing on a BUY', () => {
      const fee = getRegulatoryFee({
        proceeds: '1000',
        quantity: '10',
        side: OrderSide.BUY,
        tradedAt: '2026-06-11T15:00:00Z',
      });

      expect(fee.toFixed(), 'SEC and FINRA fees are assessed on sells only').toBe('0');
    });

    it.each([
      {expected: '0.008', from: '$8.00/M', rate: '0.0000080', tradedAt: '2024-01-30T15:00:00Z'},
      {expected: '0.0278', from: '$27.80/M', rate: '0.0000278', tradedAt: '2024-07-19T15:00:00Z'},
      {expected: '0', from: '$0.00/M', rate: '0', tradedAt: '2025-06-03T15:00:00Z'},
      {expected: '0.0206', from: '$20.60/M', rate: '0.0000206', tradedAt: '2026-06-11T15:00:00Z'},
    ])('applies the SEC rate in force on $tradedAt ($from)', ({expected, tradedAt}) => {
      // Zero shares isolates the SEC component from the TAF component.
      expect(sell('1000', '0', tradedAt).toFixed()).toBe(expected);
    });

    it('charges no SEC fee while the rate sits at zero', () => {
      /*
       * The SEC set the rate to $0.00 from 2025-05-14 until 2026-04-04. On the live account this
       * shows up as sell days in that window carrying a TAF charge and no REG charge at all.
       */
      expect(sell('1000', '0', '2025-05-13T15:00:00Z').toFixed(), 'last day of the $27.80 rate').toBe('0.0278');
      expect(sell('1000', '0', '2025-05-14T15:00:00Z').toFixed(), 'first day of the $0.00 rate').toBe('0');
      expect(sell('1000', '0', '2026-04-03T15:00:00Z').toFixed(), 'last day of the $0.00 rate').toBe('0');
      expect(sell('1000', '0', '2026-04-04T15:00:00Z').toFixed(), 'first day of the $20.60 rate').toBe('0.0206');
    });

    it('charges the FINRA TAF per share, pro-rated for fractional shares', () => {
      expect(sell('0', '326', '2024-01-30T15:00:00Z').toFixed(), '326 shares * 0.000166').toBe('0.054116');
      expect(sell('0', '0.8010852', '2026-04-23T15:00:00Z').toFixed(), 'fractional shares are pro-rated').toBe(
        '0.0001329801432'
      );
    });

    it('caps the FINRA TAF per trade', () => {
      expect(sell('0', '1000000', '2026-06-11T15:00:00Z').toFixed(), '166 uncapped, billed at the 8.30 cap').toBe(
        '8.3'
      );
    });

    it('does not round per trade, because Alpaca rounds once per day', () => {
      /*
       * On 2024-07-19 the live account sold 48 shares across 9 trades and was billed $0.01 of TAF
       * in total. Rounding each trade up to a penny would have reported $0.09. Nine unrounded
       * estimates instead sum to 0.007968, which rounds up to the $0.01 actually charged.
       */
      const dayTotal = sell('0', '48', '2024-07-19T15:00:00Z');
      const perTrade = sell('0', new Big('48').div(9).toFixed(), '2024-07-19T15:00:00Z');

      expect(dayTotal.toFixed(), '48 shares * 0.000166').toBe('0.007968');
      expect(dayTotal.round(2, Big.roundUp).toFixed(), 'the day rounds up to what Alpaca billed').toBe('0.01');
      expect(perTrade.round(2, Big.roundUp).times(9).toFixed(), 'rounding per trade over-reports by 9x').toBe('0.09');
    });
  });
});
