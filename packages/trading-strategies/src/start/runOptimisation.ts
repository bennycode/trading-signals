import {config} from 'dotenv-defaults';
import Big from 'big.js';
import {
  AlpacaBrokerMock,
  AlpacaMarketData,
  type Candle,
  OrderType,
  TradingPair,
} from '@typedtrader/exchange';
import {BacktestExecutor} from '../backtest/BacktestExecutor.js';
import {BuyOnceStrategy} from '../strategy-buy-once/BuyOnceStrategy.js';

config({path: '../exchange/.env', defaults: '../exchange/.env.defaults'});

// ── Config ──────────────────────────────────────────────────────────────────────
const SYMBOL = 'AMD';
const COUNTER = 'USD';
const STARTING_CASH = '2000';
const TP_CANDIDATES = ['0.05', '0.10', '0.15', '0.25', '0.40', '0.75', '1.50', '3.00'];
const TRAIN_SESSIONS = 30;
const VALIDATE_SESSIONS = 7;
const SLIDE_SESSIONS = 7;

// ── Fetch ~50 sessions of 1-minute AMD bars ─────────────────────────────────────
const market = new AlpacaMarketData({
  apiKey: process.env.ALPACA_LIVE_API_KEY!,
  apiSecret: process.env.ALPACA_LIVE_API_SECRET!,
  usePaperTrading: false,
});

const candles = await market.getCandles(new TradingPair(SYMBOL, COUNTER), {
  intervalInMillis: 60_000,
  startTimeFirstCandle: '2026-03-01T14:30:00.000Z',
  startTimeLastCandle: '2026-05-08T21:00:00.000Z',
});
market.disconnect();

// Group bars by UTC session (date) and keep only regular-session bars.
const sessions = groupBySession(candles);
console.log(`Loaded ${candles.length} bars across ${sessions.length} sessions.\n`);

// ── Walk-forward optimisation ───────────────────────────────────────────────────
type WindowResult = {
  validate: {start: string; end: string};
  bestTp: string;
  trainPnl: string;
  validatePnl: string;
  validateRealizedExits: string;
};

const windows: WindowResult[] = [];
for (let i = 0; i + TRAIN_SESSIONS + VALIDATE_SESSIONS <= sessions.length; i += SLIDE_SESSIONS) {
  const train = sessions.slice(i, i + TRAIN_SESSIONS);
  const validate = sessions.slice(i + TRAIN_SESSIONS, i + TRAIN_SESSIONS + VALIDATE_SESSIONS);

  // 1. Score every TP candidate on the training window.
  const trainScores = await Promise.all(TP_CANDIDATES.map(async tp => ({tp, score: await scoreWindow(train, tp)})));
  const best = trainScores.reduce((a, b) => (b.score.pnl.gt(a.score.pnl) ? b : a));

  // 2. Run the chosen TP on the held-out validation window.
  const validateScore = await scoreWindow(validate, best.tp);

  windows.push({
    bestTp: best.tp,
    trainPnl: best.score.pnl.toFixed(2),
    validate: {
      end: validate.at(-1)!.dateOfFirstBar,
      start: validate[0].dateOfFirstBar,
    },
    validatePnl: validateScore.pnl.toFixed(2),
    validateRealizedExits: `${validateScore.realizedExits}/${validate.length}`,
  });
}

// ── Print walk-forward report ───────────────────────────────────────────────────
console.log(`Walk-forward optimisation: TP ∈ {${TP_CANDIDATES.join(', ')}}, train=${TRAIN_SESSIONS}, validate=${VALIDATE_SESSIONS}, slide=${SLIDE_SESSIONS}\n`);
console.log('validate window         bestTp  trainPnL    validatePnL  TPexits');
console.log('--------------------------------------------------------------------');
for (const w of windows) {
  console.log(
    `${w.validate.start} → ${w.validate.end}   ${w.bestTp.padStart(5)}   ${w.trainPnl.padStart(8)}   ${w.validatePnl.padStart(8)}    ${w.validateRealizedExits.padStart(5)}`
  );
}

if (windows.length > 0) {
  const totalValidatePnl = windows.reduce((sum, w) => sum.plus(w.validatePnl), new Big(0));
  const tpVotes = new Map<string, number>();
  for (const w of windows) tpVotes.set(w.bestTp, (tpVotes.get(w.bestTp) ?? 0) + 1);
  const sortedVotes = [...tpVotes.entries()].sort((a, b) => b[1] - a[1]);

  console.log(`\nAggregate validation P&L: $${totalValidatePnl.toFixed(2)}`);
  console.log(`TP-pick distribution:     ${sortedVotes.map(([tp, n]) => `${tp}×${n}`).join('  ')}`);
  console.log(
    `Most-picked TP:           ${sortedVotes[0][0]} (chosen in ${sortedVotes[0][1]}/${windows.length} windows)`
  );
  console.log(
    `\nIf TP picks are tightly clustered (e.g. 1-2 distinct values), the parameter is robust.`
  );
  console.log(`If they jump around, the strategy is overfitting noise.`);
}

process.exit(0);

// ── Helpers ─────────────────────────────────────────────────────────────────────
type SessionBars = Candle[] & {dateOfFirstBar: string};

function groupBySession(bars: Candle[]): SessionBars[] {
  const byDate = new Map<string, Candle[]>();
  for (const bar of bars) {
    const date = bar.openTimeInISO.slice(0, 10);
    const time = bar.openTimeInISO.slice(11, 16);
    // Regular session only; drops pre/post-market bars to keep tests apples-to-apples.
    if (time < '14:30' || time >= '21:00') continue;
    const list = byDate.get(date) ?? [];
    list.push(bar);
    byDate.set(date, list);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, list]) => Object.assign(list, {dateOfFirstBar: date}) as SessionBars);
}

async function scoreWindow(window: SessionBars[], tp: string): Promise<{pnl: Big; realizedExits: number}> {
  let pnl = new Big(0);
  let realizedExits = 0;
  for (const session of window) {
    const result = await runSingleSessionBacktest(session, tp);
    pnl = pnl.plus(result.profitOrLoss);
    if (result.performance.totalTrades >= 2) {
      realizedExits++;
    }
  }
  return {pnl, realizedExits};
}

async function runSingleSessionBacktest(sessionBars: SessionBars, tp: string) {
  const tradingPair = new TradingPair(sessionBars[0].base, sessionBars[0].counter);
  const broker = new AlpacaBrokerMock({
    balances: new Map([
      [tradingPair.base, {available: new Big(0), hold: new Big(0)}],
      [tradingPair.counter, {available: new Big(STARTING_CASH), hold: new Big(0)}],
    ]),
    feeRates: {
      [OrderType.LIMIT]: new Big(0),
      [OrderType.MARKET]: new Big(0),
    },
  });
  const strategy = new BuyOnceStrategy({
    protected: {takeProfitNominal: tp},
    quantity: '1',
  });
  return new BacktestExecutor({
    broker,
    candles: sessionBars,
    strategy,
    tradingPair,
  }).execute();
}
