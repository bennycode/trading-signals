import {Account} from '../database/models/Account.js';

export const getAccountOrError = (userId: string, accountId: number) => {
  const account = Account.findByUserIdAndId(userId, accountId);

  if (!account) {
    throw new Error(`Account with ID "${accountId}" not found or does not belong to you`);
  }

  return account;
};
