import {describe, expect, it} from 'vitest';
import type {IbkrLedger} from './api/schema/AccountSchema.js';
import {toAvailableCash} from './IbkrCashConversion.js';

/**
 * A live read of the user's EUR account on 2026-11-19, when EUR/USD traded at 1.0993. IBKR carried
 * 0.9098 against the USD row, which is USD→EUR, so the rate multiplies into the base currency.
 */
const LIVE_EUR_ACCOUNT: IbkrLedger = {
  BASE: {cashbalance: 972.4, currency: 'BASE', exchangerate: 1, settledcash: 972.4},
  EUR: {cashbalance: 972.4, currency: 'EUR', exchangerate: 1, settledcash: 972.4},
  USD: {cashbalance: -0.01, currency: 'USD', exchangerate: 0.909_812_3, settledcash: -0.01},
};

describe('toAvailableCash', () => {
  it('spends EUR cash on a USD pair', () => {
    expect(
      toAvailableCash(LIVE_EUR_ACCOUNT, 'USD')?.round(2).toString(),
      'IBKR converts as it fills, so the whole balance is what a USD order may use'
    ).toBe('1068.78');
  });

  it('leaves the balance alone in the account currency', () => {
    expect(
      toAvailableCash(LIVE_EUR_ACCOUNT, 'EUR')?.round(2).toString(),
      'the base currency is already what the ledger reports'
    ).toBe('972.39');
  });

  it('refuses a ledger whose rows do not add up to IBKR’s own total', () => {
    const inconsistent: IbkrLedger = {
      BASE: {cashbalance: 5_000, currency: 'BASE', exchangerate: 1, settledcash: 5_000},
      EUR: {cashbalance: 1_000, currency: 'EUR', exchangerate: 1, settledcash: 1_000},
      USD: {cashbalance: 100, currency: 'USD', exchangerate: 0.909_812_3, settledcash: 100},
    };

    expect(
      toAvailableCash(inconsistent, 'USD'),
      'a rate that cannot reproduce the aggregate cannot be trusted to size an order'
    ).toBeUndefined();
  });

  it('refuses a multi-currency ledger that came without an aggregate', () => {
    const noBase: IbkrLedger = {
      EUR: {cashbalance: 1_000, currency: 'EUR', exchangerate: 1, settledcash: 1_000},
      USD: {cashbalance: 100, currency: 'USD', exchangerate: 0.909_812_3, settledcash: 100},
    };

    expect(toAvailableCash(noBase, 'USD'), 'there is nothing left to check the rates against').toBeUndefined();
  });

  it('leaves a single-currency account untouched', () => {
    const usdOnly: IbkrLedger = {
      BASE: {cashbalance: 2_500, currency: 'BASE', exchangerate: 1, settledcash: 2_500},
      USD: {cashbalance: 2_500, currency: 'USD', exchangerate: 1, settledcash: 2_500},
    };

    expect(toAvailableCash(usdOnly, 'USD')?.toString(), 'converting within one currency is the identity').toBe('2500');
  });

  it('declines when the ledger holds no row for the wanted currency', () => {
    expect(
      toAvailableCash(LIVE_EUR_ACCOUNT, 'GBP'),
      'without a GBP rate there is nothing to convert through, so the caller keeps its own figure'
    ).toBeUndefined();
  });

  it('counts unsettled proceeds out', () => {
    const unsettled: IbkrLedger = {
      BASE: {cashbalance: 1_000, currency: 'BASE', exchangerate: 1, settledcash: 400},
      USD: {cashbalance: 1_000, currency: 'USD', exchangerate: 1, settledcash: 400},
    };

    expect(
      toAvailableCash(unsettled, 'USD')?.toString(),
      'a cash account cannot buy with proceeds that have not settled'
    ).toBe('400');
  });

  it('reports nothing buyable on a negative cash balance', () => {
    const borrowed: IbkrLedger = {
      BASE: {cashbalance: -409.02, currency: 'BASE', exchangerate: 1, settledcash: -409.02},
      EUR: {cashbalance: -500, currency: 'EUR', exchangerate: 1, settledcash: -500},
      USD: {cashbalance: 100, currency: 'USD', exchangerate: 0.909_812_3, settledcash: 100},
    };

    expect(toAvailableCash(borrowed, 'USD')?.toString(), 'a margin debit is not buying power').toBe('0');
  });
});
