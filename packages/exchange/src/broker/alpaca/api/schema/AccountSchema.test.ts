import {describe, expect, it} from 'vitest';
import {AccountSchema, type Account} from './AccountSchema.js';

const ACCOUNT: Account = {
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
  it('still parses a payload that carries the retired fields', () => {
    const stale = {...ACCOUNT, daytrade_count: 2, last_daytrade_count: 1, pattern_day_trader: false};

    expect(
      () => AccountSchema.parse(stale),
      'the schema is loose, so a replayed or cached payload must not start throwing'
    ).not.toThrow();
  });

  it('still rejects a response missing a field every account reports', () => {
    const {cash: _cash, ...withoutCash} = ACCOUNT;

    expect(
      () => AccountSchema.parse(withoutCash),
      'dropping the PDT fields must not loosen the rest of the schema'
    ).toThrowError();
  });
});
