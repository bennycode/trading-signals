import {readFileSync} from 'node:fs';
import {AlpacaAPI, FmpAPI, TipRanksAPI} from '@typedtrader/exchange';
import {MomentumRotation, MomentumScorecard, TipRanksScorecard, type PortfolioScorer} from 'trading-strategies';

/**
 * One-shot momentum-rotation runner. Schedule it however you like (monthly is the natural cadence,
 * but the rebalance is low-churn and idempotent, so running it more often simply no-ops until the
 * top picks actually change).
 *
 * Env vars (read from `packages/exchange/.env` or the process environment):
 *   ALPACA_LIVE_API_KEY, ALPACA_LIVE_API_SECRET   required
 *   TIPRANKS_API_KEY                               required for the default (free) scorer
 *   FMP_API_KEY                                    required when ROTATION_SCORER=fmp
 *   ROTATION_SCORER   = "tipranks" (default) | "fmp"
 *   ALPACA_USE_PAPER  = "true" to trade the paper account (default: live)
 *   ROTATION_EXECUTE  = "true" to place orders (default: dry-run, no orders)
 */

function loadExchangeEnv(): void {
  try {
    const text = readFileSync(new URL('../exchange/.env', `file://${process.cwd()}/`), 'utf8');
    for (const line of text.split('\n')) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (match && process.env[match[1]] === undefined) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    // No exchange/.env nearby; rely on whatever is already in process.env.
  }
}

function required(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

loadExchangeEnv();

const usePaper = process.env.ALPACA_USE_PAPER === 'true';
const execute = process.env.ROTATION_EXECUTE === 'true';
const scorerKind = process.env.ROTATION_SCORER === 'fmp' ? 'fmp' : 'tipranks';

const alpaca = new AlpacaAPI({
  apiKey: required('ALPACA_LIVE_API_KEY'),
  apiSecret: required('ALPACA_LIVE_API_SECRET'),
  usePaperTrading: usePaper,
});

const scorer: PortfolioScorer =
  scorerKind === 'fmp'
    ? new MomentumScorecard(new FmpAPI({apiKey: required('FMP_API_KEY')}))
    : new TipRanksScorecard(new TipRanksAPI({apiKey: required('TIPRANKS_API_KEY')}));

const rotation = new MomentumRotation(alpaca, scorer);

console.log(
  `Momentum rotation — scorer=${scorerKind}, account=${usePaper ? 'paper' : 'LIVE'}, mode=${execute ? 'EXECUTE' : 'dry-run'}`
);

const {plan, targets} = execute ? await rotation.rebalance(new Date()) : await rotation.plan(new Date());

const money = (value: number) => `$${value.toFixed(0)}`;
console.log(`Target portfolio: ${targets.join(', ')}`);
console.log(
  `  SELL: ${plan.sells.map(order => `${order.ticker} (${money(order.notionalUsd)})`).join(', ') || '(none)'}`
);
console.log(
  `  BUY:  ${plan.buys.map(order => `${order.ticker} (${money(order.notionalUsd)})`).join(', ') || '(none)'}`
);
console.log(`  HOLD: ${plan.holds.join(', ') || '(none)'}`);

if (execute) {
  console.log(`\nOrders placed: ${plan.sells.length} sells, ${plan.buys.length} buys.`);
} else {
  console.log('\nDry-run only — no orders placed. Set ROTATION_EXECUTE=true to trade.');
}
