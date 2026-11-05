/**
 * Pre-placement checks for a protective stop on the live Trading212 account.
 *
 * Prints the facts that each caught a real mistake in the October/November 2026 stops, and places
 * nothing. Run `--selftest` to exercise the arithmetic without network.
 */
import assert from 'node:assert/strict';
import {AlpacaAPI} from '../../../packages/exchange/src/broker/alpaca/api/AlpacaAPI.js';
import {ATR} from '../../../packages/trading-signals/src/index.js';
import {Trading212API} from '../../../packages/exchange/src/broker/trading212/api/Trading212API.js';
import type {Position} from '../../../packages/exchange/src/broker/trading212/api/schema/PositionSchema.js';

/**
 * Measured on AAPL, MSFT, NET and CAT over 7-11 years of daily bars: a trail at `m x ATR` fires
 * about `30 / m` times a year, and the rate barely varies by instrument because ATR already
 * cancels out how volatile each one is. So the multiple is a firing-rate dial, not a price.
 */
export function expectedFiringsPerYear(multiple: number): number {
  assert.ok(multiple > 0, 'A multiple has to be positive.');
  return 30 / multiple;
}

export interface Anchors {
  /** The fill that opened the position, which is what a floor-from-entry stop is measured against. */
  entryFill: number;
  /** Highest high since entry: the Chandelier anchor. */
  peak: number;
  /** Last close before the stop is placed, i.e. where the market actually is. */
  priorClose: number;
}

/**
 * The same stop price in every anchor at once. NET's single $278.98 read 1.84x off its fill, 0.75x
 * off the prior close and 5.42x off the peak, so quoting one number without the anchor says
 * nothing. Printing all three makes the choice explicit instead of implied.
 */
export function anchorMultiples(stop: number, anchors: Anchors, atr: number): Record<keyof Anchors, number> {
  assert.ok(atr > 0, 'ATR has to be positive.');
  return {
    entryFill: (anchors.entryFill - stop) / atr,
    peak: (anchors.peak - stop) / atr,
    priorClose: (anchors.priorClose - stop) / atr,
  };
}

/**
 * Whether `newStop = max(oldStop, price - multiple * ATR)` actually permits the move. Ratcheting
 * MSFT from 495.12 to 512.98 broke this rule, which said to leave it alone, and it fired four days
 * later.
 */
export function ratchetAllows(oldStop: number, price: number, atr: number, multiple: number): boolean {
  return price - multiple * atr > oldStop;
}

/** Shares the orders endpoint can reach; an AutoInvest pie holds back the rest. */
export function freeQuantity(position: Position): number {
  return position.quantity - position.pieQuantity;
}

function selftest(): void {
  assert.equal(expectedFiringsPerYear(3), 10, '3x fires about ten times a year on the measured sample');
  assert.ok(expectedFiringsPerYear(1.67) > expectedFiringsPerYear(3.31), 'a tighter stop fires more often');

  const m = anchorMultiples(278.98, {entryFill: 309.98, peak: 370.35, priorClose: 291.69}, 16.86);
  assert.ok(Math.abs(m.entryFill - 1.84) < 0.01, 'reproduces NET read off its entry fill');
  assert.ok(Math.abs(m.priorClose - 0.75) < 0.01, 'reproduces NET read off the prior close');
  assert.ok(Math.abs(m.peak - 5.42) < 0.01, 'reproduces NET read off the running peak');
  assert.ok(m.peak > m.entryFill && m.entryFill > m.priorClose, 'one price, three very different readings');

  // The MSFT ratchet that should not have happened: 531.01 - 3*10.80 = 498.61, below the old stop.
  assert.equal(ratchetAllows(495.12, 531.01, 10.8, 3), true, 'the rule did allow a small move up');
  assert.equal(ratchetAllows(512.98, 531.01, 10.8, 3), false, 'but never as far as 512.98');

  assert.equal(freeQuantity({pieQuantity: 0.38164414, quantity: 90.86413138} as Position), 90.48248724);
  console.log('selftest ok');
}

async function main(): Promise<void> {
  const ticker = process.argv[2];
  const proposed = Number(process.argv[3]);
  assert.ok(ticker, 'Usage: check.mts <T212 ticker> <proposed stop price> [atrMultiple]');
  assert.ok(Number.isFinite(proposed) && proposed > 0, 'A proposed stop price is required.');
  const multiple = Number(process.argv[4] ?? 3);

  const t212Key = process.env.TRADING212_LIVE_API_KEY;
  const t212Secret = process.env.TRADING212_LIVE_API_SECRET;
  const alpacaKey = process.env.ALPACA_LIVE_API_KEY;
  const alpacaSecret = process.env.ALPACA_LIVE_API_SECRET;
  assert.ok(t212Key && t212Secret, 'Missing TRADING212_LIVE_API_KEY / _SECRET');
  assert.ok(alpacaKey && alpacaSecret, 'Missing ALPACA_LIVE_API_KEY / _SECRET');

  const t212 = new Trading212API({apiKey: t212Key, apiSecret: t212Secret, usePaperTrading: false});
  const [positions, openOrders] = await Promise.all([t212.getPositions(), t212.getOrders()]);
  const position = positions.find(p => p.ticker === ticker);
  assert.ok(position, `No open position for ${ticker}.`);

  // Trading212 publishes no bars, so the ATR and the all-time high come from Alpaca.
  const symbol = ticker.replace(/_US_EQ$/, '').replace(/d_EQ$/, '');
  assert.ok(
    ticker.endsWith('_US_EQ'),
    `${ticker} is not a US listing; Alpaca has no bars for it, so ATR and ATH cannot be read here.`
  );
  const alpaca = new AlpacaAPI({apiKey: alpacaKey, apiSecret: alpacaSecret, usePaperTrading: false});
  const bars = await alpaca.getStockBars({
    adjustment: 'all',
    // The free SIP feed refuses the last 15 minutes, and a bare date resolves into that window.
    end: new Date(Date.now() - 20 * 60_000).toISOString(),
    limit: 10000,
    start: '2016-01-01',
    symbols: symbol,
    timeframe: '1Day',
  });
  const series = bars.bars?.[symbol] ?? [];
  assert.ok(series.length > 100, `Only ${series.length} bars for ${symbol}.`);

  const atrIndicator = new ATR(14);
  let ath = 0;
  let peakSinceEntry = 0;
  const entryDate = position.initialFillDate.slice(0, 10);
  for (const bar of series) {
    atrIndicator.add({close: bar.c, high: bar.h, low: bar.l});
    ath = Math.max(ath, bar.c);
    if (bar.t.slice(0, 10) >= entryDate) {
      peakSinceEntry = Math.max(peakSinceEntry, bar.h);
    }
  }
  const atrResult = atrIndicator.getResult();
  assert.ok(atrResult !== null, 'ATR did not warm up.');
  const atr = Number(atrResult);
  const priorClose = series.at(-1)!.c;

  console.log(`\n${ticker} — pre-placement checks for a stop at ${proposed}\n${'='.repeat(60)}`);
  console.log(`ATR14 ${atr.toFixed(2)} (${((atr / priorClose) * 100).toFixed(2)}% of price), last close ${priorClose}`);

  const anchors = anchorMultiples(proposed, {entryFill: position.averagePrice, peak: peakSinceEntry, priorClose}, atr);
  console.log('\n1. Which anchor? The same price in each:');
  console.log(`   off prior close ${priorClose}      ${anchors.priorClose.toFixed(2)}x ATR`);
  console.log(`   off average entry ${position.averagePrice.toFixed(2)}   ${anchors.entryFill.toFixed(2)}x ATR`);
  console.log(`   off peak since entry ${peakSinceEntry.toFixed(2)}  ${anchors.peak.toFixed(2)}x ATR`);

  const firings = expectedFiringsPerYear(anchors.priorClose);
  console.log(`\n2. Expected firings: ~${firings.toFixed(1)}/year at ${anchors.priorClose.toFixed(2)}x`);
  const heldDays = (Date.now() - new Date(position.initialFillDate).getTime()) / 86_400_000;
  console.log(
    `   held ${heldDays.toFixed(0)} days so far; ${firings > 8 ? 'TIGHT for that horizon' : 'consistent with a multi-month hold'}`
  );

  const ddFromAth = ((priorClose - ath) / ath) * 100;
  console.log(`\n3. Distance from all-time high: ${ddFromAth.toFixed(2)}% (ATH close ${ath.toFixed(2)})`);
  if (ddFromAth > -3) {
    console.log('   NEAR A RECORD — a pullback here is noise, not deterioration.');
  }

  const free = freeQuantity(position);
  console.log(`\n4. Reachable size: ${free} of ${position.quantity} (${position.pieQuantity} in a pie)`);
  assert.ok(free > 0, 'The whole position sits in an AutoInvest pie; no stop can be placed.');

  const breakEven = position.averagePrice;
  console.log(
    `\n5. Versus break-even ${breakEven.toFixed(2)}: stop is ${(((proposed - breakEven) / breakEven) * 100).toFixed(2)}%`
  );
  console.log(`   ${proposed > breakEven ? 'protects a profit' : 'CAPS A LOSS — not a profit stop'}`);

  const resting = openOrders.find(o => o.ticker === ticker && o.type === 'STOP');
  console.log('\n6. Replacing an existing stop?');
  if (resting?.stopPrice == null) {
    console.log('   nothing resting — this is a first placement');
  } else {
    const allowed = ratchetAllows(resting.stopPrice, priorClose, atr, multiple);
    console.log(
      `   resting at ${resting.stopPrice}; max(old, price - ${multiple}xATR) = ${Math.max(resting.stopPrice, priorClose - multiple * atr).toFixed(2)}`
    );
    console.log(
      `   ${allowed ? 'the rule permits a move up' : 'THE RULE SAYS LEAVE IT — moving it anyway is what broke MSFT'}`
    );
  }

  console.log('\nNothing placed. Confirm before ordering.');
}

if (process.argv.includes('--selftest')) {
  selftest();
} else {
  await main();
}
