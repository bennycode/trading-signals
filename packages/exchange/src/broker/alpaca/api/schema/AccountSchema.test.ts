import {describe, expect, it} from 'vitest';
import {AccountSchema, type Account} from './AccountSchema.js';

const CASH_ACCOUNT: Account = {
  account_blocked: false,
  account_number: '245695408',
  buying_power: '325.7',
  cash: '325.7',
  created_at: '2023-08-08T18:58:27.267Z',
  currency: 'USD',
  equity: '425.7',
  id: 'a1b2c3d4-0000-0000-0000-000000000000',
  initial_margin: '0',
  last_equity: '424.5',
  long_market_value: '100',
  maintenance_margin: '0',
  multiplier: '1',
  portfolio_value: '425.7',
  short_market_value: '0',
  shorting_enabled: false,
  status: 'ACTIVE',
  trade_suspended_by_user: false,
  trading_blocked: false,
  transfers_blocked: false,
};

describe('AccountSchema', () => {
  it('parses a cash account that omits the Pattern Day Trader fields', () => {
    const account = AccountSchema.parse(CASH_ACCOUNT);

    expect(account.cash, 'a cash account must parse; PDT tracking is margin-only').toBe('325.7');
    expect(account.daytrade_count).toBeUndefined();
    expect(account.pattern_day_trader).toBeUndefined();
  });

  it('parses a margin account that reports them', () => {
    const account = AccountSchema.parse({
      ...CASH_ACCOUNT,
      daytrade_count: 2,
      multiplier: '4',
      pattern_day_trader: false,
    });

    expect(account.daytrade_count).toBe(2);
    expect(account.pattern_day_trader).toBe(false);
  });

  it('still rejects a response missing a field every account reports', () => {
    const {cash: _cash, ...withoutCash} = CASH_ACCOUNT;

    expect(
      () => AccountSchema.parse(withoutCash),
      'making the PDT fields optional must not loosen the rest of the schema'
    ).toThrowError();
  });
});
