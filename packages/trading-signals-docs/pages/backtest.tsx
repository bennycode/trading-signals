import {useState, useCallback, useEffect, useRef} from 'react';
import Big from 'big.js';
import {AlpacaExchangeMock, TradingPair} from '@typedtrader/exchange';
import type {ExchangeCandle} from '@typedtrader/exchange';
import {
  BacktestExecutor,
  BuyAndHoldStrategy,
  BuyOnceStrategy,
  BuyBelowSellAboveStrategy,
  type BacktestResult,
  BuyOnceConfig,
  BuyBelowSellAboveConfig,
} from 'trading-strategies';
import {DatasetSelector} from '../components/DatasetSelector';
import {StrategyConfigurator} from '../components/StrategyConfigurator';
import {BacktestResults} from '../components/BacktestResults';
import {datasets} from '../utils/datasets';
import type {CandleDataset} from '../utils/types';
import {strategyDefinitions, type StrategyId} from '../utils/strategySchemas';

function createStrategy(strategyId: StrategyId, config: Record<string, unknown>) {
  switch (strategyId) {
    case 'buy-and-hold':
      return new BuyAndHoldStrategy();
    case 'buy-once':
      return new BuyOnceStrategy(config as unknown as BuyOnceConfig);
    case 'buy-below-sell-above':
      return new BuyBelowSellAboveStrategy(config as BuyBelowSellAboveConfig);
  }
}

function parseInitialAmount(value: string, label: string): Big {
  const trimmed = value.trim();

  if (trimmed === '') {
    return new Big(0);
  }

  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`Invalid ${label} amount: "${value}". Please enter a non-negative numeric value.`);
  }

  return new Big(trimmed);
}

function createExchange(candles: ExchangeCandle[], initialBase: string, initialCounter: string) {
  const base = candles[0]?.base ?? 'BTC';
  const counter = candles[0]?.counter ?? 'USD';
  const balances = new Map([
    [base, {available: parseInitialAmount(initialBase, 'base'), hold: new Big(0)}],
    [counter, {available: parseInitialAmount(initialCounter, 'counter'), hold: new Big(0)}],
  ]);
  return new AlpacaExchangeMock({balances});
}

export default function BacktestPage() {
  const [selectedDataset, setSelectedDataset] = useState(datasets[0].id);
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyId>('buy-and-hold');
  const [configJson, setConfigJson] = useState('{}');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customDataset, setCustomDataset] = useState<CandleDataset | null>(null);
  const [initialBase, setInitialBase] = useState('0');
  const [initialCounter, setInitialCounter] = useState('10000');
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  }, []);

  const currentDataset = selectedDataset === 'custom' ? customDataset : datasets.find(d => d.id === selectedDataset)!;
  const candles = (currentDataset?.candles ?? []) as ExchangeCandle[];

  // Recompute defaults when dataset or strategy changes (including custom dataset uploads)
  useEffect(() => {
    const def = strategyDefinitions.find(s => s.id === selectedStrategy)!;
    const defaults = def.getDefaultConfig(candles);
    setConfigJson(JSON.stringify(defaults, null, 2));
  }, [selectedDataset, selectedStrategy, customDataset]);

  // Validate JSON on every change
  useEffect(() => {
    try {
      const parsed = JSON.parse(configJson);
      const def = strategyDefinitions.find(s => s.id === selectedStrategy)!;
      const parseResult = def.schema.safeParse(parsed);
      if (!parseResult.success) {
        const issues = parseResult.error.issues;
        setValidationError(issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '));
      } else {
        setValidationError(null);
      }
    } catch {
      setValidationError('Invalid JSON');
    }
  }, [configJson, selectedStrategy]);

  const runBacktest = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      const parsed = JSON.parse(configJson);
      const def = strategyDefinitions.find(s => s.id === selectedStrategy)!;
      const parseResult = def.schema.safeParse(parsed);
      if (!parseResult.success) {
        setError('Invalid configuration');
        return;
      }

      const config = parseResult.data as Record<string, unknown>;
      const strategy = createStrategy(selectedStrategy, config);
      const base = candles[0]?.base ?? 'BTC';
      const counter = candles[0]?.counter ?? 'USD';
      const tradingPair = new TradingPair(base, counter);
      const exchange = createExchange(candles, initialBase, initialCounter);

      const executor = new BacktestExecutor({
        candles,
        exchange,
        strategy,
        tradingPair,
      });

      const backtestResult = await executor.execute();
      setResult(backtestResult);
      showToast(`Backtest complete — ${backtestResult.trades.length} trade${backtestResult.trades.length === 1 ? '' : 's'} simulated`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Backtest failed');
    } finally {
      setRunning(false);
    }
  }, [configJson, selectedStrategy, candles, initialBase, initialCounter, showToast]);

  const handleStrategyChange = (id: StrategyId) => {
    setSelectedStrategy(id);
    setResult(null);
  };

  const handleDatasetChange = (id: string) => {
    setSelectedDataset(id);
    setResult(null);
  };

  const handleCustomDataset = (candles: ExchangeCandle[], name: string) => {
    setCustomDataset({id: 'custom', name, description: `Custom upload: ${name} (${candles.length} candles)`, candles});
    setSelectedDataset('custom');
    setResult(null);
  };

  return (
    <div className="flex gap-6 relative">
      {/* Sidebar */}
      <div className="w-64 shrink-0 space-y-4 sticky top-4 self-start">
        <DatasetSelector
          datasets={datasets}
          selectedDataset={selectedDataset}
          onDatasetChange={handleDatasetChange}
          onCustomDataset={handleCustomDataset}
          customDatasetName={customDataset?.name}
        />
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Initial Balance</h3>
          <div className="space-y-2">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Base ({candles[0]?.base ?? 'Base'})</label>
              <input
                type="text"
                value={initialBase}
                onChange={e => setInitialBase(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Counter ({candles[0]?.counter ?? 'Counter'})</label>
              <input
                type="text"
                value={initialCounter}
                onChange={e => setInitialCounter(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>
        </div>
        <StrategyConfigurator
          selectedStrategy={selectedStrategy}
          onStrategyChange={handleStrategyChange}
          configJson={configJson}
          onConfigJsonChange={setConfigJson}
          validationError={validationError}
          candles={candles}
        />
        <button
          onClick={runBacktest}
          disabled={!!validationError || running}
          className={`w-full py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
            validationError || running
              ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
              : 'bg-purple-600 hover:bg-purple-700 text-white cursor-pointer'
          }`}>
          {running ? 'Running...' : 'Run Backtest'}
        </button>
        {error && (
          <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-3">
            <p className="text-red-400 text-xs">{error}</p>
          </div>
        )}
      </div>

      {/* Toast notification */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-purple-600 text-white text-sm font-medium px-4 py-3 rounded-lg shadow-lg animate-[fadeIn_0.15s_ease-out]">
          {toast}
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {result ? (
          <BacktestResults result={result} candles={candles} />
        ) : (
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-12 text-center">
            <h2 className="text-xl font-semibold text-white mb-3">Visual Backtester</h2>
            <p className="text-slate-400 max-w-md mx-auto">
              Select a dataset and strategy from the sidebar, configure parameters, then click
              &ldquo;Run Backtest&rdquo; to see the results.
            </p>
            <div className="mt-6 grid grid-cols-3 gap-4 max-w-lg mx-auto text-left">
              <div className="bg-slate-700/50 rounded-lg p-3">
                <div className="text-purple-400 font-semibold text-sm">1. Dataset</div>
                <div className="text-slate-400 text-xs mt-1">Choose market conditions</div>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-3">
                <div className="text-purple-400 font-semibold text-sm">2. Strategy</div>
                <div className="text-slate-400 text-xs mt-1">Pick a trading strategy</div>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-3">
                <div className="text-purple-400 font-semibold text-sm">3. Run</div>
                <div className="text-slate-400 text-xs mt-1">Analyze performance</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
