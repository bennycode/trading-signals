import {readFile} from 'node:fs/promises';
import {parseArgs} from 'node:util';
import {TradingPair} from '@typedtrader/exchange';
import type {Candle} from '@typedtrader/exchange';
import Big from 'big.js';
import {runSingleBacktest} from '../backtest/runSingleBacktest.js';
import type {BacktestPerformanceSummary} from '../backtest/BacktestResult.js';
import {getStrategyNames} from '../strategy/StrategyRegistry.js';

/**
 * Each ranking metric knows how to pull its value out of a performance summary and whether a smaller number
 * is the better one (drawdown is the only "lower is better" metric here).
 */
interface RankingMetric {
  get: (performance: BacktestPerformanceSummary) => Big;
  label: string;
  lowerIsBetter: boolean;
}

const METRICS: Record<string, RankingMetric> = {
  drawdown: {get: p => p.maxDrawdownPercentage, label: 'MaxDD%', lowerIsBetter: true},
  return: {get: p => p.returnPercentage, label: 'Return%', lowerIsBetter: false},
  winrate: {get: p => p.winRate, label: 'WinRate%', lowerIsBetter: false},
};

const {values} = parseArgs({
  options: {
    balance: {default: '10000', short: 'b', type: 'string'},
    config: {default: '{}', short: 'c', type: 'string'},
    data: {short: 'd', type: 'string'},
    grid: {short: 'g', type: 'string'},
    metric: {default: 'return', short: 'm', type: 'string'},
    strategy: {short: 's', type: 'string'},
    top: {default: '10', short: 't', type: 'string'},
  },
});

function usage(): never {
  console.log(
    'Usage: tsx src/start/runOptimisation.ts --data <candles.json> --strategy <name> --grid <json> [--config <json>] [--metric <name>] [--balance <amount>] [--top <n>]'
  );
  console.log('');
  console.log('Runs one backtest per parameter combination and ranks them by a risk-adjusted metric.');
  console.log('');
  console.log('Options:');
  console.log('  --data, -d       Path to candle JSON file');
  console.log('  --strategy, -s   Strategy name from registry');
  console.log('  --grid, -g       Parameter grid as JSON: each key maps to an array of candidate values');
  console.log('                   e.g. \'{"trailReversalPercent":[1,2,3],"offset":[0.5,1]}\'');
  console.log('  --config, -c     Base config merged into every combination (default: {})');
  console.log(`  --metric, -m     Ranking metric: ${Object.keys(METRICS).join(', ')} (default: return)`);
  console.log('  --balance, -b    Starting cash in counter currency (default: 10000)');
  console.log('  --top, -t        How many of the best combinations to print (default: 10)');
  console.log('');
  console.log('Available strategies:');
  for (const name of getStrategyNames()) {
    console.log(`  ${name}`);
  }
  process.exit(1);
}

if (!values.data || !values.strategy || !values.grid) {
  usage();
}

const metric = METRICS[values.metric.toLowerCase()];
if (!metric) {
  console.error(`Unknown metric "${values.metric}". Available: ${Object.keys(METRICS).join(', ')}`);
  process.exit(1);
}

/** Builds every combination of grid values (the Cartesian product), merged on top of the base config. */
function buildCombinations(
  baseConfig: Record<string, unknown>,
  grid: Record<string, unknown[]>
): Record<string, unknown>[] {
  let combinations: Record<string, unknown>[] = [{...baseConfig}];

  for (const [key, candidates] of Object.entries(grid)) {
    const expanded: Record<string, unknown>[] = [];
    for (const combination of combinations) {
      for (const candidate of candidates) {
        expanded.push({...combination, [key]: candidate});
      }
    }
    combinations = expanded;
  }

  return combinations;
}

// 1. Load candle data
let raw: string;
try {
  raw = await readFile(values.data, 'utf8');
} catch (error) {
  console.error(
    `Failed to read candle file "${values.data}": ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
}

let candles: Candle[];
try {
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('Candle file must contain a JSON array');
  }
  candles = parsed;
} catch (error) {
  console.error(`Invalid candle file "${values.data}": ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

if (candles.length === 0) {
  console.error(`Candle file "${values.data}" is empty. Need at least one candle to run a backtest.`);
  process.exit(1);
}

// 2. Parse the base config and the parameter grid
const baseConfig: Record<string, unknown> = JSON.parse(values.config);

const grid: Record<string, unknown[]> = {};
try {
  const parsedGrid: unknown = JSON.parse(values.grid);
  if (typeof parsedGrid !== 'object' || parsedGrid === null || Array.isArray(parsedGrid)) {
    throw new Error('Grid must be a JSON object mapping config keys to arrays of values');
  }
  for (const [key, candidates] of Object.entries(parsedGrid)) {
    if (!Array.isArray(candidates) || candidates.length === 0) {
      throw new Error(`Grid key "${key}" must map to a non-empty array of candidate values`);
    }
    grid[key] = candidates;
  }
} catch (error) {
  console.error(`Invalid grid "${values.grid}": ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const gridKeys = Object.keys(grid);
const combinations = buildCombinations(baseConfig, grid);

const firstCandle = candles[0];
const lastCandle = candles[candles.length - 1];
const tradingPair = new TradingPair(firstCandle.base, firstCandle.counter);
const startingBalance = new Big(values.balance);
const topCount = Math.max(1, Number.parseInt(values.top, 10) || 10);

console.log(`Candles:    ${candles.length} from ${values.data}`);
console.log(`Period:     ${firstCandle.openTimeInISO.slice(0, 10)} → ${lastCandle.openTimeInISO.slice(0, 10)}`);
console.log(`Pair:       ${tradingPair.asString('/')}`);
console.log(`Strategy:   ${values.strategy}`);
console.log(`Grid:       ${gridKeys.join(', ')}`);
console.log(`Metric:     ${metric.label} (${metric.lowerIsBetter ? 'lower is better' : 'higher is better'})`);
console.log(`Runs:       ${combinations.length} combinations`);
console.log('---');

// 3. Backtest every combination
interface OptimisationRun {
  combination: Record<string, unknown>;
  performance: BacktestPerformanceSummary;
}

const runs: OptimisationRun[] = [];

for (let index = 0; index < combinations.length; index++) {
  const combination = combinations[index];
  try {
    const {result} = await runSingleBacktest({
      candles,
      config: combination,
      startingBalance,
      strategyName: values.strategy,
      tradingPair,
    });
    runs.push({combination, performance: result.performance});
  } catch (error) {
    console.warn(`  skipped ${JSON.stringify(combination)}: ${error instanceof Error ? error.message : String(error)}`);
  }

  if ((index + 1) % 10 === 0 || index + 1 === combinations.length) {
    console.log(`  ran ${index + 1}/${combinations.length}`);
  }
}

if (runs.length === 0) {
  console.error('No combination produced a valid backtest. Check the grid values against the strategy schema.');
  process.exit(1);
}

// 4. Rank by the chosen metric
runs.sort((a, b) => {
  const comparison = metric.get(a.performance).cmp(metric.get(b.performance));
  return metric.lowerIsBetter ? comparison : -comparison;
});

// 5. Print the leaderboard. Each row shows only the grid parameters that actually varied.
function describeCombination(combination: Record<string, unknown>) {
  return gridKeys.map(key => `${key}=${JSON.stringify(combination[key])}`).join(' ');
}

/*
 * Reference stats shown on every row. The active ranking metric is dropped here because it already has its
 * own sort-key column, so e.g. ranking by Return% doesn't print a duplicate "Return%" column.
 */
interface ReferenceColumn {
  format: (performance: BacktestPerformanceSummary) => string;
  key: string;
  label: string;
}

const allReferenceColumns: ReferenceColumn[] = [
  {format: p => p.returnPercentage.toFixed(2), key: 'return', label: 'Return%'},
  {format: p => p.maxDrawdownPercentage.toFixed(2), key: 'drawdown', label: 'MaxDD%'},
  {format: p => p.winRate.toFixed(1), key: 'winrate', label: 'WinRate%'},
  {format: p => String(p.totalTrades), key: 'trades', label: 'Trades'},
];

const referenceColumns = allReferenceColumns.filter(column => column.key !== values.metric.toLowerCase());

const headerColumns = ['#', metric.label, ...referenceColumns.map(column => column.label), 'Parameters'];
const rows = runs.slice(0, topCount).map((run, position) => {
  const {performance: p} = run;
  return [
    String(position + 1),
    metric.get(p).toFixed(4),
    ...referenceColumns.map(column => column.format(p)),
    describeCombination(run.combination),
  ];
});

const widths = headerColumns.map((header, column) => Math.max(header.length, ...rows.map(row => row[column].length)));

function formatRow(columns: string[]) {
  return columns.map((value, column) => value.padEnd(widths[column])).join('  ');
}

console.log('');
console.log(`=== OPTIMISATION RESULTS (top ${Math.min(topCount, runs.length)} of ${runs.length}) ===`);
console.log(formatRow(headerColumns));
console.log(formatRow(widths.map(width => '-'.repeat(width))));
for (const row of rows) {
  console.log(formatRow(row));
}

const best = runs[0];
console.log('');
console.log(`Best by ${metric.label}: ${describeCombination(best.combination)}`);
console.log(`Run it with: --config '${JSON.stringify(best.combination)}'`);
