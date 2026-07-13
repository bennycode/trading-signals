import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import dynamic from 'next/dynamic';
import Big from 'big.js';
import {AlpacaBrokerMock, TradingPair} from '@typedtrader/exchange';
import type {Candle} from '@typedtrader/exchange';
import {
  BacktestExecutor,
  BuyOnceStrategy,
  GraphStrategy,
  StrategyGraphSchema,
  createSmaCrossoverGraph,
} from 'trading-strategies';
import type {BacktestResult, StrategyGraphInput} from 'trading-strategies';
import {BacktestResults} from '../components/BacktestResults';
import {DatasetSelector} from '../components/DatasetSelector';
import {datasets} from '../utils/datasets';
import type {CandleDataset} from '../utils/types';

const GraphEditor = dynamic(() => import('../components/graph/GraphEditor').then(module => module.GraphEditor), {
  loading: () => (
    <div className="h-[640px] rounded-lg border border-slate-700 flex items-center justify-center text-slate-500">
      Loading canvas…
    </div>
  ),
  ssr: false,
});

function createExchange(candles: Candle[], initialBase: string, initialCounter: string) {
  const base = candles[0]?.base ?? 'BTC';
  const counter = candles[0]?.counter ?? 'USD';
  const balances = new Map([
    [base, {available: new Big(initialBase || '0'), hold: new Big(0)}],
    [counter, {available: new Big(initialCounter || '0'), hold: new Big(0)}],
  ]);
  return new AlpacaBrokerMock({balances});
}

export default function GraphBuilderPage() {
  const [loadedGraph, setLoadedGraph] = useState<StrategyGraphInput>(() => createSmaCrossoverGraph());
  const [editorKey, setEditorKey] = useState(0);
  const [currentGraph, setCurrentGraph] = useState<StrategyGraphInput | null>(null);
  const [selectedDataset, setSelectedDataset] = useState(datasets[0].id);
  const [customDataset, setCustomDataset] = useState<CandleDataset | null>(null);
  const [initialBase, setInitialBase] = useState('0');
  const [initialCounter, setInitialCounter] = useState('10000');
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [baselineResult, setBaselineResult] = useState<BacktestResult | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [jsonDraft, setJsonDraft] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentDataset = selectedDataset === 'custom' ? customDataset : datasets.find(d => d.id === selectedDataset)!;
  const candles = currentDataset?.candles ?? [];

  const onGraphChange = useCallback((graph: StrategyGraphInput) => {
    setCurrentGraph(graph);
  }, []);

  /**
   * The single source of truth for "is this strategy runnable": constructing the real
   * interpreter. Whatever error it throws is exactly what a backtest would hit.
   */
  const validationError = useMemo(() => {
    if (!currentGraph || Object.keys(currentGraph.nodes).length === 0) {
      return 'Add nodes to build a strategy';
    }
    try {
      new GraphStrategy(currentGraph);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : 'Invalid graph';
    }
  }, [currentGraph]);

  const loadGraph = useCallback((graph: StrategyGraphInput) => {
    setLoadedGraph(graph);
    // Sync immediately — validation must not lag until the client-only canvas re-hydrates.
    setCurrentGraph(graph);
    setEditorKey(key => key + 1);
    setResult(null);
    setBaselineResult(null);
  }, []);

  // Clear the pending "Copied!" reset when navigating away mid-countdown.
  useEffect(() => {
    return () => {
      if (copiedTimer.current) {
        clearTimeout(copiedTimer.current);
      }
    };
  }, []);

  const copyJson = useCallback(async () => {
    if (!currentGraph) {
      return;
    }
    await navigator.clipboard.writeText(JSON.stringify(currentGraph, null, 2));
    if (copiedTimer.current) {
      clearTimeout(copiedTimer.current);
    }
    setCopied(true);
    copiedTimer.current = setTimeout(() => setCopied(false), 2000);
  }, [currentGraph]);

  const applyJson = useCallback(() => {
    try {
      const parsed = StrategyGraphSchema.parse(JSON.parse(jsonDraft));
      new GraphStrategy(parsed); // validate node semantics too — bad JSON never reaches the canvas
      setJsonError(null);
      loadGraph(parsed);
    } catch (error) {
      setJsonError(error instanceof Error ? error.message : 'Invalid JSON');
    }
  }, [jsonDraft, loadGraph]);

  const runBacktest = useCallback(async () => {
    if (!currentGraph || validationError) {
      return;
    }
    setRunning(true);
    setRunError(null);
    try {
      const base = candles[0]?.base ?? 'BTC';
      const counter = candles[0]?.counter ?? 'USD';
      const tradingPair = new TradingPair(base, counter);

      const [backtestResult, baseline] = await Promise.all([
        new BacktestExecutor({
          broker: createExchange(candles, initialBase, initialCounter),
          candles,
          strategy: new GraphStrategy(currentGraph),
          tradingPair,
        }).execute(),
        new BacktestExecutor({
          broker: createExchange(candles, initialBase, initialCounter),
          candles,
          strategy: new BuyOnceStrategy(),
          tradingPair,
        }).execute(),
      ]);

      setResult(backtestResult);
      setBaselineResult(baseline);
    } catch (error) {
      setRunError(error instanceof Error ? error.message : 'Backtest failed');
    } finally {
      setRunning(false);
    }
  }, [currentGraph, validationError, candles, initialBase, initialCounter]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Strategy Builder</h1>
          <p className="text-slate-400 text-sm mt-1 max-w-2xl">
            Stack building blocks into a trading strategy: candles flow through batchers and indicators into conditions
            that fire order advice. The graph you see is exactly what runs in the backtest.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            data-testid="graph-clear"
            onClick={() => loadGraph({connections: [], nodes: {}, version: 1})}
            className="py-2 px-4 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-white transition-colors cursor-pointer">
            Clear canvas
          </button>
          <button
            data-testid="graph-load-template"
            onClick={() => loadGraph(createSmaCrossoverGraph())}
            className="py-2 px-4 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-white transition-colors cursor-pointer">
            Load SMA Crossover template
          </button>
        </div>
      </div>

      <div className="flex gap-6 items-start">
        {/* Sidebar */}
        <div className="w-64 shrink-0 space-y-4 sticky top-4 self-start">
          <DatasetSelector
            datasets={datasets}
            selectedDataset={selectedDataset}
            onDatasetChange={id => {
              setSelectedDataset(id);
              setResult(null);
              setBaselineResult(null);
            }}
            onCustomDataset={(customCandles, name) => {
              setCustomDataset({
                candles: customCandles,
                description: `Custom upload: ${name} (${customCandles.length} candles)`,
                id: 'custom',
                name,
              });
              setSelectedDataset('custom');
              setResult(null);
              setBaselineResult(null);
            }}
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
                  onChange={event => setInitialBase(event.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Counter ({candles[0]?.counter ?? 'Counter'})
                </label>
                <input
                  type="text"
                  value={initialCounter}
                  onChange={event => setInitialCounter(event.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
          </div>

          <div
            data-testid="graph-validation"
            className={`rounded-lg p-3 border text-xs ${
              validationError
                ? 'bg-amber-900/20 border-amber-800/50 text-amber-300'
                : 'bg-emerald-900/20 border-emerald-800/50 text-emerald-300'
            }`}>
            {validationError ?? '✓ Graph is valid and ready to run'}
          </div>

          <button
            data-testid="graph-run-backtest"
            onClick={runBacktest}
            disabled={!!validationError || running || candles.length === 0}
            className={`w-full py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
              validationError || running || candles.length === 0
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-purple-600 hover:bg-purple-700 text-white cursor-pointer'
            }`}>
            {running ? 'Running…' : 'Run Backtest'}
          </button>
          {runError && (
            <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-3">
              <p className="text-red-400 text-xs">{runError}</p>
            </div>
          )}

          <details className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <summary className="text-sm font-semibold text-white cursor-pointer select-none">
              Share / Import JSON
            </summary>
            <div className="mt-3 space-y-2">
              <button
                data-testid="graph-copy-json"
                onClick={copyJson}
                className="w-full py-2 px-3 rounded text-xs font-medium bg-slate-700 hover:bg-slate-600 text-white transition-colors cursor-pointer">
                {copied ? 'Copied!' : 'Copy current graph as JSON'}
              </button>
              <textarea
                data-testid="graph-json-input"
                value={jsonDraft}
                onChange={event => setJsonDraft(event.target.value)}
                placeholder="Paste a strategy graph JSON here…"
                rows={5}
                className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
              />
              <button
                data-testid="graph-apply-json"
                onClick={applyJson}
                className="w-full py-2 px-3 rounded text-xs font-medium bg-slate-700 hover:bg-slate-600 text-white transition-colors cursor-pointer">
                Load JSON into canvas
              </button>
              {jsonError && <p className="text-red-400 text-xs">{jsonError}</p>}
            </div>
          </details>
        </div>

        {/* Canvas */}
        <div className="flex-1 min-w-0">
          <GraphEditor key={editorKey} initialGraph={loadedGraph} onGraphChange={onGraphChange} />
        </div>
      </div>

      {result && (
        <div data-testid="graph-backtest-results">
          <BacktestResults result={result} baselineResult={baselineResult} candles={candles} />
        </div>
      )}
    </div>
  );
}
