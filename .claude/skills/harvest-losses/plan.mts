/**
 * Plans a loss harvest on the live Trading212 account: cut every position whose loss is under a
 * threshold, then offset the realised loss from the smallest winner that can cover it alone.
 *
 * Prints a plan and places nothing. Run `--selftest` to exercise the arithmetic without network.
 */
import assert from 'node:assert/strict';
import {Trading212API} from '../../../packages/exchange/src/broker/trading212/api/Trading212API.js';
import type {HistoryOrder} from '../../../packages/exchange/src/broker/trading212/api/schema/HistoryOrderSchema.js';
import type {Position} from '../../../packages/exchange/src/broker/trading212/api/schema/PositionSchema.js';

/** T212 charges this on the EUR leg of a non-EUR trade; it lands in the realised result. */
const FX_FEE_RATE = 0.0015;

/**
 * A position held inside an AutoInvest pie cannot be sold through the orders endpoint — it answers
 * `selling-equity-not-owned, owned: 0.0`. The pie has to be unwound in the app first.
 */
export function isSellable(position: Position): boolean {
  return position.pieQuantity < position.quantity;
}

/**
 * Losers worth cutting, smallest loss first. `ppl` is the EUR result and already carries the
 * currency effect; `fxPpl` only breaks out how much of it came from FX, so adding the two
 * double-counts the move.
 */
export function pickLosers(positions: Position[], thresholdEur: number) {
  const losers = positions.filter(p => p.ppl < 0 && Math.abs(p.ppl) < thresholdEur);
  return {
    blocked: losers.filter(p => !isSellable(p)),
    sellable: losers.filter(p => isSellable(p)).sort((a, b) => b.ppl - a.ppl),
  };
}

/** The smallest winner whose own gain covers `needEur`, which is what keeps the rest untouched. */
export function pickWinner(positions: Position[], needEur: number) {
  return positions
    .filter(p => p.ppl >= needEur && isSellable(p))
    .sort((a, b) => a.ppl - b.ppl)
    .at(0);
}

export interface Tranche {
  eurPerShare: number;
  qty: number;
}

/**
 * Replays the order history into the FIFO tranches still open, which is the cost basis German tax
 * uses: each buy converted at its own day's rate. `netValue` is the real EUR cash moved, fees
 * included, so it needs no separate fee adjustment. A ticker that was fully exited and re-bought
 * (Rolls-Royce did this twice) must not drag its old basis forward, hence the replay.
 */
export function openTranches(history: HistoryOrder[]): Tranche[] {
  const fills = history
    .filter(h => h.fill?.filledAt != null && h.fill.quantity != null && h.fill.walletImpact?.netValue != null)
    .sort((a, b) => (a.fill?.filledAt ?? '').localeCompare(b.fill?.filledAt ?? ''));

  const queue: Tranche[] = [];
  for (const {fill} of fills) {
    const qty = fill?.quantity ?? 0;
    const netValue = fill?.walletImpact?.netValue ?? 0;
    if (qty > 0) {
      queue.push({eurPerShare: netValue / qty, qty});
      continue;
    }
    let remaining = -qty;
    while (remaining > 1e-9 && queue.length > 0) {
      const head = queue[0];
      assert.ok(head);
      const taken = Math.min(head.qty, remaining);
      head.qty -= taken;
      remaining -= taken;
      if (head.qty <= 1e-9) {
        queue.shift();
      }
    }
  }
  return queue;
}

/**
 * Shares to sell so the realised gain reaches `targetGainEur`, consuming tranches in FIFO order so
 * a sale that spills into a newer, differently-priced tranche still sizes correctly.
 *
 * Rounds down to `decimals`, which lands the gain just under the target on purpose: leftover loss
 * carries forward, while leftover gain is taxed now.
 */
export function sizeSale(
  tranches: Tranche[],
  proceedsPerShareEur: number,
  targetGainEur: number,
  decimals = 2
): {gainEur: number; qty: number} {
  let qty = 0;
  let gain = 0;
  for (const tranche of tranches) {
    const perShare = proceedsPerShareEur - tranche.eurPerShare;
    if (perShare <= 0) {
      continue;
    }
    const needed = (targetGainEur - gain) / perShare;
    const taken = Math.min(tranche.qty, needed);
    qty += taken;
    gain += taken * perShare;
    if (gain >= targetGainEur - 1e-9) {
      break;
    }
  }
  const factor = 10 ** decimals;
  const rounded = Math.floor(qty * factor) / factor;
  return {gainEur: gainAt(tranches, proceedsPerShareEur, rounded), qty: rounded};
}

function gainAt(tranches: Tranche[], proceedsPerShareEur: number, qty: number): number {
  let remaining = qty;
  let gain = 0;
  for (const tranche of tranches) {
    const taken = Math.min(tranche.qty, remaining);
    gain += taken * (proceedsPerShareEur - tranche.eurPerShare);
    remaining -= taken;
    if (remaining <= 1e-9) {
      break;
    }
  }
  return gain;
}

/** Net EUR a share returns today: the quote converted at the live rate, less the conversion fee. */
export function proceedsPerShare(position: Position, totalCostEur: number): number {
  const eurValue = totalCostEur + position.ppl;
  const rate = (position.quantity * position.currentPrice) / eurValue;
  return (position.currentPrice / rate) * (1 - FX_FEE_RATE);
}

function selftest(): void {
  const pos = (over: Partial<Position>): Position => ({
    averagePrice: 100,
    currentPrice: 100,
    fxPpl: 0,
    initialFillDate: '2026-01-01',
    maxBuy: null,
    maxSell: null,
    pieQuantity: 0,
    ppl: 0,
    quantity: 1,
    ticker: 'X',
    ...over,
  });

  const positions = [
    pos({ppl: -1500, ticker: 'BIG_LOSS'}),
    pos({ppl: -120, ticker: 'SMALL_LOSS'}),
    pos({ppl: -40, ticker: 'TINY_LOSS'}),
    pos({pieQuantity: 1, ppl: -12, ticker: 'PIE_LOSS'}),
    pos({ppl: 90, ticker: 'SMALL_WIN'}),
    pos({ppl: 400, ticker: 'MID_WIN'}),
    pos({ppl: 5000, ticker: 'BIG_WIN'}),
  ];

  const {blocked, sellable} = pickLosers(positions, 1000);
  assert.deepEqual(
    sellable.map(p => p.ticker),
    ['TINY_LOSS', 'SMALL_LOSS'],
    'only losses under the threshold, and the pie position is not among them'
  );
  assert.deepEqual(
    blocked.map(p => p.ticker),
    ['PIE_LOSS'],
    'a pie position is reported, not silently skipped'
  );

  assert.equal(
    pickWinner(positions, 160)?.ticker,
    'MID_WIN',
    'the smallest winner that covers it alone, not the biggest'
  );
  assert.equal(pickWinner(positions, 4000)?.ticker, 'BIG_WIN', 'falls through to the next winner up when needed');
  assert.equal(pickWinner(positions, 99_999), undefined, 'no single winner can cover it');

  // A ticker fully exited and re-bought keeps only the newest basis (the Rolls-Royce shape).
  const fill = (filledAt: string, quantity: number, netValue: number): HistoryOrder => ({
    fill: {filledAt, quantity, walletImpact: {netValue}},
    order: {},
  });
  const reentered = openTranches([
    fill('2024-03-21T00:00:00Z', 100, 1000),
    fill('2024-05-31T00:00:00Z', -100, 1200),
    fill('2026-08-05T00:00:00Z', 20, 400),
  ]);
  assert.deepEqual(reentered, [{eurPerShare: 20, qty: 20}], 'the closed 2024 tranche does not survive into the basis');

  // Two tranches, cheaper one first: FIFO spill has to switch per-share gain mid-sale.
  const spill: Tranche[] = [
    {eurPerShare: 50, qty: 10},
    {eurPerShare: 80, qty: 10},
  ];
  const exact = sizeSale(spill, 100, 600, 4);
  assert.ok(exact.qty > 10, 'a target beyond the first tranche must consume part of the second');
  assert.ok(exact.gainEur <= 600, 'rounding leaves the gain at or under the target, never above');
  assert.ok(600 - exact.gainEur < 1, 'and still within a euro of it');

  const single = sizeSale([{eurPerShare: 496.741, qty: 10}], 552.47, 508.47, 2);
  assert.equal(single.qty, 9.12, 'reproduces the Mastercard sizing from 2026-10-28');
  assert.ok(single.gainEur < 508.47, 'deliberately lands under the realised loss');

  console.log('selftest ok');
}

async function main(): Promise<void> {
  const thresholdEur = Number(process.argv[2] ?? 1000);
  const apiKey = process.env.TRADING212_LIVE_API_KEY;
  const apiSecret = process.env.TRADING212_LIVE_API_SECRET;
  assert.ok(apiKey, 'Missing TRADING212_LIVE_API_KEY');
  assert.ok(apiSecret, 'Missing TRADING212_LIVE_API_SECRET');

  const api = new Trading212API({apiKey, apiSecret, usePaperTrading: false});
  const positions = await api.getPositions();
  const {blocked, sellable} = pickLosers(positions, thresholdEur);

  console.log(`Cut (loss under ${thresholdEur} EUR):`);
  for (const p of sellable) {
    console.log(`  SELL ${p.ticker} qty=${p.quantity} ppl=${p.ppl.toFixed(2)}`);
  }
  const lossEur = sellable.reduce((sum, p) => sum + p.ppl, 0);
  if (sellable.length > 0) {
    console.log(
      `  estimated realised loss ${lossEur.toFixed(2)} EUR (confirm against the fills before sizing the offset)`
    );
  } else {
    console.log(`  nothing to cut`);
  }

  for (const p of blocked) {
    console.log(`  SKIP ${p.ticker} ppl=${p.ppl.toFixed(2)} — held in an AutoInvest pie, sell it in the app`);
  }

  if (sellable.length === 0) {
    return;
  }

  const winner = pickWinner(positions, -lossEur);
  if (winner === undefined) {
    console.log(`\nNo single winner covers ${(-lossEur).toFixed(2)} EUR. Offset needs more than one position.`);
    return;
  }

  const tranches = openTranches(await api.getHistoryOrders(winner.ticker));
  const totalCostEur = tranches.reduce((sum, t) => sum + t.qty * t.eurPerShare, 0);
  const perShare = proceedsPerShare(winner, totalCostEur);
  const {gainEur, qty} = sizeSale(tranches, perShare, -lossEur);

  console.log(`\nOffset from ${winner.ticker} (smallest winner covering it alone, ppl ${winner.ppl.toFixed(2)}):`);
  console.log(
    `  SELL ${qty} of ${winner.quantity} -> gain ${gainEur.toFixed(2)} EUR, residual ${(gainEur + lossEur).toFixed(2)}`
  );
  console.log(`\nMarket orders, in the 15:30-17:30 CET overlap. Nothing placed — confirm first.`);
}

if (process.argv.includes('--selftest')) {
  selftest();
} else {
  await main();
}
