import {describe, expect, it} from 'vitest';
import type {IbkrAPI} from './api/IbkrAPI.js';
import {isIbkrPaperAccount, resolveIbkrAccountId} from './IbkrAccountSelection.js';

type SessionApi = Pick<IbkrAPI, 'getAccounts' | 'selectAccount'>;

function createApi(accounts: string[], selected?: string): SessionApi {
  let selectedAccount = selected ?? accounts[0];

  return {
    getAccounts: async () => ({accounts, ...(selectedAccount ? {selectedAccount} : {})}),
    selectAccount: async (accountId: string) => {
      selectedAccount = accountId;
    },
  };
}

describe('isIbkrPaperAccount', () => {
  it('reads the account number, which is the only thing that says which environment it is', () => {
    expect(isIbkrPaperAccount('DU1234567')).toBe(true);
    expect(isIbkrPaperAccount('DF1234567'), 'an advisor’s paper account is numbered DF').toBe(true);
    expect(isIbkrPaperAccount('U1234567')).toBe(false);
    expect(
      isIbkrPaperAccount('F1234567'),
      'an advisor’s live account is numbered F, and only a D means simulated'
    ).toBe(false);
  });
});

describe('resolveIbkrAccountId', () => {
  it('takes whichever account the session holds when no environment is stated', async () => {
    expect(await resolveIbkrAccountId({api: createApi(['DU1234567'])})).toBe('DU1234567');
  });

  it('refuses a live session when paper trading was asked for', async () => {
    await expect(
      resolveIbkrAccountId({api: createApi(['U1234567']), paper: true}),
      'the gateway has no paper switch, so a strategy that believes it is simulated would spend real money here'
    ).rejects.toThrow(/paper trading was asked for/);
  });

  it('refuses a paper session when live trading was asked for', async () => {
    await expect(
      resolveIbkrAccountId({api: createApi(['DU1234567']), paper: false}),
      'simulated fills reported as real ones make every result that follows meaningless'
    ).rejects.toThrow(/live trading was asked for/);
  });

  it('accepts the session that matches what was asked for', async () => {
    expect(await resolveIbkrAccountId({api: createApi(['DU1234567']), paper: true})).toBe('DU1234567');
    expect(await resolveIbkrAccountId({api: createApi(['U1234567']), paper: false})).toBe('U1234567');
  });

  it('names the accounts the session actually serves when the requested one is absent', async () => {
    await expect(resolveIbkrAccountId({api: createApi(['U1']), requested: 'U2'})).rejects.toThrow(
      /does not serve account "U2".*It has: U1/s
    );
  });
});
