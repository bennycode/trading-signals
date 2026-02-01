import {Account} from '../database/models/Account.js';

export const getAccountOrError = (ownerAddress: string, accountId: number) => {
  const account = Account.findByOwnerAddressAndId(ownerAddress, accountId);

  if (!account) {
    throw new Error(`Account with ID "${accountId}" not found or does not belong to you`);
  }

  return account;
};
