import assert from 'node:assert/strict';
import {runGateway} from './startIbkrGateway.js';

/**
 * Runs the IBKR Client Portal Gateway and keeps it logged in.
 *
 *   npm run gateway:ibkr:op            # the live login
 *   npm run gateway:ibkr:paper:op      # the paper login
 *
 * Which account the gateway logs into is the only thing that decides whether orders are simulated,
 * and nothing downstream can change it afterwards. So the login is settled here and nowhere else —
 * the credential pair and the login page's Live/Paper mode, which IBKR refuses a paper username
 * without — and the username is printed to make the choice visible before a second factor is
 * approved.
 */
const paper = process.argv.includes('--paper');

/**
 * The pair is taken whole: IBKR gives the two logins different passwords, so completing a prefixed
 * username with the unprefixed password builds a pair belonging to neither.
 */
function credentials(): {password: string | undefined; username: string | undefined} {
  if (paper) {
    return {password: process.env.IBKR_PAPER_PASSWORD, username: process.env.IBKR_PAPER_USERNAME};
  }

  if (process.env.IBKR_LIVE_USERNAME ?? process.env.IBKR_LIVE_PASSWORD) {
    return {password: process.env.IBKR_LIVE_PASSWORD, username: process.env.IBKR_LIVE_USERNAME};
  }

  // `IBKR_ACCOUNT` predates the paper support and is still honoured so an existing setup keeps working.
  return {password: process.env.IBKR_PASSWORD, username: process.env.IBKR_USERNAME ?? process.env.IBKR_ACCOUNT};
}

const {password, username} = credentials();
const prefix = paper ? 'IBKR_PAPER' : 'IBKR';

/*
 * Named one at a time: a paper password is set separately from the username and is the half more
 * likely to be missing, so reporting both would send somebody looking at the wrong one.
 */
assert.ok(username, `Missing ${prefix}_USERNAME in environment`);
assert.ok(password, `Missing ${prefix}_PASSWORD in environment`);

console.info(`Logging the gateway in as "${username}" (${paper ? 'paper' : 'live'}).`);

await runGateway({
  account: username,
  paper,
  password,
  // IB Key sends a push to the phone. A passkey cannot be used: the Web API does not support it.
  twoFactorMethod: process.env.IBKR_TWO_FACTOR_METHOD ?? 'IB Key',
});
