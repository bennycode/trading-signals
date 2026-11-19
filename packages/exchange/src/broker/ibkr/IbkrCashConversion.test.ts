import {describe, expect, it} from 'vitest';
import type {IbkrLedger} from './api/schema/AccountSchema.js';
import {toAvailableCash, toExchangeRateDirection} from './IbkrCashConversion.js';

/**
 * EUR 1000 and USD 100 against a EUR base, with EUR/USD at 1.16. Reading the rate as USD→EUR
 * totals 1086.21; reading it the other way totals 1116. Only the first matches `BASE`, so this
 * ledger says which way round the rate goes.
 */
const DISCRIMINATING: IbkrLedger = {
  BASE: {cashbalance: 1_086.21, currency: 'EUR', settledcash: 1_086.21},
  EUR: {cashbalance: 1_000, currency: 'EUR', exchangerate: 1, settledcash: 1_000},
  USD: {cashbalance: 100, currency: 'USD', exchangerate: 0.862_068_9, settledcash: 100},
};

/** The same account with the USD row emptied, which is the shape the conversion exists for. */
const EUR_ONLY_CASH: IbkrLedger = {
  BASE: {cashbalance: 1_000, currency: 'EUR', settledcash: 1_000},
  EUR: {cashbalance: 1_000, currency: 'EUR', exchangerate: 1, settledcash: 1_000},
  USD: {cashbalance: 0, currency: 'USD', exchangerate: 0.862_068_9, settledcash: 0},
};

describe('toExchangeRateDirection', () => {
  it('reads the rate in whichever direction reproduces IBKR’s own total', () => {
    expect(
      toExchangeRateDirection(DISCRIMINATING),
      'the BASE row is the only unit-bearing fact in the ledger, so it decides'
    ).toBe('to-base');
  });

  it('reports nothing when both readings produce the same total', () => {
    expect(
      toExchangeRateDirection(EUR_ONLY_CASH),
      'an empty USD row makes the aggregate identical either way, which is no evidence at all'
    ).toBeUndefined();
  });

  it('refuses rates that reconcile to neither total', () => {
    const inconsistent: IbkrLedger = {
      BASE: {cashbalance: 5_000, currency: 'EUR', settledcash: 5_000},
      EUR: {cashbalance: 1_000, currency: 'EUR', exchangerate: 1, settledcash: 1_000},
      USD: {cashbalance: 100, currency: 'USD', exchangerate: 0.862, settledcash: 100},
    };

    expect(
      toExchangeRateDirection(inconsistent),
      'a ledger that does not add up cannot be trusted to size an order'
    ).toBeUndefined();
  });

  it('reports nothing when IBKR sent no aggregate to reconcile against', () => {
    expect(toExchangeRateDirection({EUR: {cashbalance: 1_000, currency: 'EUR', exchangerate: 1}})).toBeUndefined();
  });
});

describe('toAvailableCash', () => {
  it('spends EUR cash on a USD pair', () => {
    expect(
      toAvailableCash(DISCRIMINATING, 'USD')?.round(2).toString(),
      'IBKR converts as it fills, so the whole balance is what a USD order may use'
    ).toBe('1260');
  });

  it('declines rather than guess when the ledger cannot settle the rate direction', () => {
    expect(
      toAvailableCash(EUR_ONLY_CASH, 'USD'),
      'the two readings differ by the square of the rate, so picking one would oversize an order'
    ).toBeUndefined();
  });

  it('leaves a single-currency account untouched', () => {
    const usdOnly: IbkrLedger = {
      BASE: {cashbalance: 2_500, currency: 'USD', settledcash: 2_500},
      USD: {cashbalance: 2_500, currency: 'USD', exchangerate: 1, settledcash: 2_500},
    };

    expect(toAvailableCash(usdOnly, 'USD')?.toString(), 'converting within one currency is the identity').toBe('2500');
  });

  it('declines when the ledger holds no row for the wanted currency', () => {
    expect(
      toAvailableCash(DISCRIMINATING, 'GBP'),
      'without a GBP rate there is nothing to convert through, so the caller keeps its own figure'
    ).toBeUndefined();
  });

  it('counts unsettled proceeds out', () => {
    const unsettled: IbkrLedger = {
      BASE: {cashbalance: 1_000, currency: 'USD', settledcash: 400},
      USD: {cashbalance: 1_000, currency: 'USD', exchangerate: 1, settledcash: 400},
    };

    expect(
      toAvailableCash(unsettled, 'USD')?.toString(),
      'a cash account cannot buy with proceeds that have not settled'
    ).toBe('400');
  });

  it('reports nothing buyable on a negative cash balance', () => {
    const borrowed: IbkrLedger = {
      BASE: {cashbalance: -413.79, currency: 'EUR', settledcash: -413.79},
      EUR: {cashbalance: -500, currency: 'EUR', exchangerate: 1, settledcash: -500},
      USD: {cashbalance: 100, currency: 'USD', exchangerate: 0.862_068_9, settledcash: 100},
    };

    expect(toAvailableCash(borrowed, 'USD')?.toString(), 'a margin debit is not buying power').toBe('0');
  });
});
