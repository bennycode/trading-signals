import assert from 'node:assert/strict';
import {runGateway} from './startIbkrGateway.js';

/**
 * Runs the IBKR Client Portal Gateway and keeps it logged in.
 *
 *   npm run gateway:ibkr:op
 */
const account = process.env.IBKR_ACCOUNT;
const password = process.env.IBKR_PASSWORD;

assert.ok(account, 'Missing IBKR_ACCOUNT in environment');
assert.ok(password, 'Missing IBKR_PASSWORD in environment');

await runGateway({
  account,
  password,
  // IB Key sends a push to the phone. A passkey cannot be used: the Web API does not support it.
  twoFactorMethod: process.env.IBKR_TWO_FACTOR_METHOD ?? 'IB Key',
});
