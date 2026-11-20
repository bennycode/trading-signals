import assert from 'node:assert/strict';
import {Trading212API} from '../api/Trading212API.js';

/** The cash ledger, which is the only place Trading212 names a wallet's currency. */
const apiKey = process.env.TRADING212_LIVE_API_KEY;
const apiSecret = process.env.TRADING212_LIVE_API_SECRET;
assert.ok(apiKey, 'Missing TRADING212_LIVE_API_KEY in environment');
assert.ok(apiSecret, 'Missing TRADING212_LIVE_API_SECRET in environment');

const api = new Trading212API({apiKey, apiSecret, usePaperTrading: false});
const transactions = await api.getTransactions({maxPages: 2});

console.info(`${transactions.length} transactions, newest first:\n`);
for (const transaction of transactions.slice(0, 6)) {
  console.info(
    `${transaction.dateTime}  ${transaction.type.padEnd(22)} ${String(transaction.amount).padStart(10)} ${transaction.currency}`
  );
}

const currencies = new Set(transactions.map(transaction => transaction.currency));
console.info('\ncurrencies seen:', [...currencies].join(', '));
