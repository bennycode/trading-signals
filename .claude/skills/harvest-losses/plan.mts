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
 * Shares the orders endpoint can actually reach. An AutoInvest pie can hold a position whole or in
 * part, and the endpoint refuses anything above the free remainder with `selling-equity-not-owned`,
 * quoting that remainder as what is owned. Apple showed the partial case: 90.86 shares of which
 * 0.38 sat in a pie, so the full-size order was rejected and 90.48 went through.
 */
export function freeQuantity(position: Position): number {
  return position.quantity - position.pieQuantity;
}

/** Whether any of the position can be reached at all; a wholly pie-held one cannot. */
export function isSellable(position: Position): boolean {
  return freeQuantity(position) > 0;
}

/**
 * The result selling only the free portion would realise. A pie holding back part of a position
 * holds back that share of its gain or loss too, so the plan must not promise the whole `ppl`.
 */
export function realisableEur(position: Position): number {
  return position.ppl * (freeQuantity(position) / position.quantity);
}

/**
 * Trims a FIFO queue to the shares that can actually be sold. The tranches are replayed from the
 * full order history, so they sum to the whole position including whatever a pie has locked away.
 */
export function capTranches(tranches: Tranche[], maxQty: number): Tranche[] {
  const capped: Tranche[] = [];
  let remaining = maxQty;
  for (const tranche of tranches) {
    if (remaining <= 1e-9) {
      break;
    }
    const qty = Math.min(tranche.qty, remaining);
    capped.push({eurPerShare: tranche.eurPerShare, qty});
    remaining -= qty;
  }
  return capped;
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
    /** Partly pie-held, so cutting them realises less than their `ppl` says. */
    partial: losers.filter(p => isSellable(p) && p.pieQuantity > 0),
    sellable: losers.filter(p => isSellable(p)).sort((a, b) => realisableEur(b) - realisableEur(a)),
  };
}

/**
 * The smallest winner whose own gain covers `needEur`, which is what keeps the rest untouched. The
 * gain that counts is the reachable one: a pie holding part of a winner holds back part of its gain.
 */
export function pickWinner(positions: Position[], needEur: number) {
  return positions
    .filter(p => isSellable(p) && realisableEur(p) >= needEur)
    .sort((a, b) => realisableEur(a) - realisableEur(b))
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
    // Half pie-held, so only half of the -60 is reachable (the Apple shape, which the API rejects).
    pos({pieQuantity: 5, ppl: -60, quantity: 10, ticker: 'HALF_PIE_LOSS'}),
    pos({ppl: 90, ticker: 'SMALL_WIN'}),
    pos({ppl: 400, ticker: 'MID_WIN'}),
    pos({ppl: 5000, ticker: 'BIG_WIN'}),
  ];

  assert.equal(freeQuantity(pos({pieQuantity: 0.38164414, quantity: 90.86413138})).toFixed(8), '90.48248724');
  assert.equal(isSellable(pos({pieQuantity: 1, quantity: 1})), false, 'a wholly pie-held position is unreachable');
  assert.equal(
    isSellable(pos({pieQuantity: 0.38, quantity: 90.86})),
    true,
    'a partly pie-held position still has shares the endpoint can reach'
  );

  const {blocked, partial, sellable} = pickLosers(positions, 1000);
  assert.deepEqual(
    sellable.map(p => p.ticker),
    ['HALF_PIE_LOSS', 'TINY_LOSS', 'SMALL_LOSS'],
    'ordered by the loss actually reachable, so the half-pie -60 ranks as -30 and sorts first'
  );
  assert.deepEqual(
    blocked.map(p => p.ticker),
    ['PIE_LOSS'],
    'a wholly pie-held position is reported, not silently skipped'
  );
  assert.deepEqual(
    partial.map(p => p.ticker),
    ['HALF_PIE_LOSS'],
    'a partly blocked position is called out'
  );
  assert.equal(
    realisableEur(pos({pieQuantity: 5, ppl: -60, quantity: 10})),
    -30,
    'a pie holds back its share of the result'
  );

  assert.equal(
    pickWinner(positions, 160)?.ticker,
    'MID_WIN',
    'the smallest winner that covers it alone, not the biggest'
  );
  assert.equal(pickWinner(positions, 4000)?.ticker, 'BIG_WIN', 'falls through to the next winner up when needed');
  assert.equal(pickWinner(positions, 99_999), undefined, 'no single winner can cover it');
  assert.equal(
    pickWinner([pos({pieQuantity: 9, ppl: 500, quantity: 10, ticker: 'MOSTLY_PIE_WIN'})], 300),
    undefined,
    'a winner whose gain is mostly locked in a pie cannot cover the loss'
  );

  assert.deepEqual(
    capTranches(
      [
        {eurPerShare: 50, qty: 10},
        {eurPerShare: 80, qty: 10},
      ],
      14
    ),
    [
      {eurPerShare: 50, qty: 10},
      {eurPerShare: 80, qty: 4},
    ],
    'the queue is trimmed to the sellable shares, oldest tranche first'
  );

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
  const {blocked, partial, sellable} = pickLosers(positions, thresholdEur);

  console.log(`Cut (loss under ${thresholdEur} EUR):`);
  for (const p of sellable) {
    const note = p.pieQuantity > 0 ? ` (${p.pieQuantity} of ${p.quantity} pie-held, full ppl ${p.ppl.toFixed(2)})` : '';
    console.log(`  SELL ${p.ticker} qty=${freeQuantity(p)} loss=${realisableEur(p).toFixed(2)}${note}`);
  }
  const lossEur = sellable.reduce((sum, p) => sum + realisableEur(p), 0);
  if (sellable.length > 0) {
    console.log(
      `  estimated realised loss ${lossEur.toFixed(2)} EUR (confirm against the fills before sizing the offset)`
    );
  } else {
    console.log(`  nothing to cut`);
  }

  for (const p of blocked) {
    console.log(`  SKIP ${p.ticker} ppl=${p.ppl.toFixed(2)} — wholly pie-held, so sell it in the app instead`);
  }
  if (partial.length > 0) {
    console.log(
      `  note: ${partial.map(p => p.ticker).join(', ')} partly pie-held, so the loss above is under their full ppl`
    );
  }

  if (sellable.length === 0) {
    return;
  }

  const winner = pickWinner(positions, -lossEur);
  if (winner === undefined) {
    console.log(`\nNo single winner covers ${(-lossEur).toFixed(2)} EUR. Offset needs more than one position.`);
    return;
  }

  const allTranches = openTranches(await api.getHistoryOrders(winner.ticker));
  // The cost basis spans the whole position, while only its free part can actually be sold.
  const totalCostEur = allTranches.reduce((sum, t) => sum + t.qty * t.eurPerShare, 0);
  const perShare = proceedsPerShare(winner, totalCostEur);
  const {gainEur, qty} = sizeSale(capTranches(allTranches, freeQuantity(winner)), perShare, -lossEur);

  console.log(
    `\nOffset from ${winner.ticker} (smallest winner covering it alone, reachable gain ${realisableEur(winner).toFixed(2)}):`
  );
  console.log(
    `  SELL ${qty} of ${freeQuantity(winner)} sellable -> gain ${gainEur.toFixed(2)} EUR, residual ${(gainEur + lossEur).toFixed(2)}`
  );
  console.log(`\nMarket orders, in the 15:30-17:30 CET overlap. Nothing placed — confirm first.`);
}

if (process.argv.includes('--selftest')) {
  selftest();
} else {
  await main();
}
