import {useEffect, useState} from 'react';
import {AD, CMF, EMV, PVT, VROC, VWMA} from 'trading-signals';
import {DatasetSelector} from '../../components/DatasetSelector';
import {IndicatorList} from '../../components/IndicatorList';
import {SignalBadge} from '../../components/SignalBadge';
import type {IndicatorConfig} from '../../utils/types';
import {datasets} from '../../utils/datasets';
import {renderSingleIndicator} from '../../utils/renderUtils';

const indicators: IndicatorConfig[] = [
  {
    chartTitle: 'Accumulation/Distribution',
    color: '#8b5cf6',
    createIndicator: () => new AD(),
    description: 'Accumulation/Distribution',
    details:
      'Uses the relationship between close price and high-low range, weighted by volume, to measure money flow. Rising AD confirms an uptrend, falling AD confirms a downtrend.',
    getChartData: result => ({x: 0, y: result.result}),
    getTableColumns: () => [
      {header: 'Period', key: 'period'},
      {header: 'Date', key: 'date'},
      {className: 'text-slate-300 py-2 px-3', header: 'Close', key: 'close', render: val => `$${val.toFixed(2)}`},
      {className: 'text-slate-300 py-2 px-3', header: 'Volume', key: 'volume'},
      {className: 'text-white font-mono py-2 px-3', header: 'AD', key: 'result'},
      {className: 'py-2 px-3', header: 'Signal', key: 'signal', render: val => <SignalBadge signal={val} />},
    ],
    id: 'ad',
    name: 'AD',
    processData: (indicator, candle) => {
      indicator.add({close: Number(candle.close), high: Number(candle.high), low: Number(candle.low), volume: Number(candle.volume)});
      const result = indicator.getResult();
      const signal = indicator.getSignal();
      return {close: Number(candle.close), result, signal, volume: Number(candle.volume)};
    },
    requiredInputs: 1,
    type: 'single',
    yAxisLabel: 'AD',
  },
  {
    chartTitle: 'Chaikin Money Flow (20)',
    color: '#ec4899',
    createIndicator: () => new CMF(20),
    description: 'Chaikin Money Flow',
    details:
      'Measures buying and selling pressure over a period. Oscillates between -1 and +1. Values above 0 indicate accumulation (buying pressure), below 0 indicate distribution (selling pressure).',
    getChartData: result => ({x: 0, y: result.result}),
    getTableColumns: () => [
      {header: 'Period', key: 'period'},
      {header: 'Date', key: 'date'},
      {className: 'text-slate-300 py-2 px-3', header: 'Close', key: 'close', render: val => `$${val.toFixed(2)}`},
      {className: 'text-slate-300 py-2 px-3', header: 'Volume', key: 'volume'},
      {className: 'text-white font-mono py-2 px-3', header: 'CMF', key: 'result'},
      {className: 'py-2 px-3', header: 'Signal', key: 'signal', render: val => <SignalBadge signal={val} />},
    ],
    id: 'cmf',
    name: 'CMF',
    processData: (indicator, candle) => {
      indicator.add({close: Number(candle.close), high: Number(candle.high), low: Number(candle.low), volume: Number(candle.volume)});
      const result = indicator.isStable ? indicator.getResult() : null;
      const signal = indicator.getSignal();
      return {close: Number(candle.close), result, signal, volume: Number(candle.volume)};
    },
    requiredInputs: 20,
    type: 'single',
    yAxisLabel: 'CMF',
  },
  {
    chartTitle: 'Price Volume Trend',
    color: '#10b981',
    createIndicator: () => new PVT(),
    description: 'Price Volume Trend',
    details:
      'Cumulative indicator that adds a proportional amount of volume based on percentage price change. More sensitive than OBV because it weights volume by price change rather than adding full volume.',
    getChartData: result => ({x: 0, y: result.result}),
    getTableColumns: () => [
      {header: 'Period', key: 'period'},
      {header: 'Date', key: 'date'},
      {className: 'text-slate-300 py-2 px-3', header: 'Close', key: 'close', render: val => `$${val.toFixed(2)}`},
      {className: 'text-slate-300 py-2 px-3', header: 'Volume', key: 'volume'},
      {className: 'text-white font-mono py-2 px-3', header: 'PVT', key: 'result'},
      {className: 'py-2 px-3', header: 'Signal', key: 'signal', render: val => <SignalBadge signal={val} />},
    ],
    id: 'pvt',
    name: 'PVT',
    processData: (indicator, candle) => {
      indicator.add({close: Number(candle.close), high: Number(candle.high), low: Number(candle.low), volume: Number(candle.volume)});
      const result = indicator.getResult();
      const signal = indicator.getSignal();
      return {close: Number(candle.close), result, signal, volume: Number(candle.volume)};
    },
    requiredInputs: 2,
    type: 'single',
    yAxisLabel: 'PVT',
  },
  {
    chartTitle: 'Ease of Movement (14)',
    color: '#3b82f6',
    createIndicator: () => new EMV(14),
    description: 'Ease of Movement',
    details:
      'Relates price change to volume to assess trend strength. Positive EMV means prices are advancing with ease, negative EMV means prices are declining easily. Uses SMA smoothing.',
    getChartData: result => ({x: 0, y: result.result}),
    getTableColumns: () => [
      {header: 'Period', key: 'period'},
      {header: 'Date', key: 'date'},
      {className: 'text-slate-300 py-2 px-3', header: 'Close', key: 'close', render: val => `$${val.toFixed(2)}`},
      {className: 'text-slate-300 py-2 px-3', header: 'Volume', key: 'volume'},
      {className: 'text-white font-mono py-2 px-3', header: 'EMV', key: 'result'},
      {className: 'py-2 px-3', header: 'Signal', key: 'signal', render: val => <SignalBadge signal={val} />},
    ],
    id: 'emv',
    name: 'EMV',
    processData: (indicator, candle) => {
      indicator.add({close: Number(candle.close), high: Number(candle.high), low: Number(candle.low), volume: Number(candle.volume)});
      const result = indicator.isStable ? indicator.getResult() : null;
      const signal = indicator.getSignal();
      return {close: Number(candle.close), result, signal, volume: Number(candle.volume)};
    },
    requiredInputs: 15,
    type: 'single',
    yAxisLabel: 'EMV',
  },
  {
    chartTitle: 'Volume Rate of Change (14)',
    color: '#06b6d4',
    createIndicator: () => new VROC(14),
    description: 'Volume Rate of Change',
    details:
      'Measures percentage change in volume over a period. Positive VROC indicates increasing volume (confirms trend), negative VROC indicates declining volume (weakening trend).',
    getChartData: result => ({x: 0, y: result.result}),
    getTableColumns: () => [
      {header: 'Period', key: 'period'},
      {header: 'Date', key: 'date'},
      {className: 'text-slate-300 py-2 px-3', header: 'Volume', key: 'volume'},
      {className: 'text-white font-mono py-2 px-3', header: 'VROC %', key: 'result'},
      {className: 'py-2 px-3', header: 'Signal', key: 'signal', render: val => <SignalBadge signal={val} />},
    ],
    id: 'vroc',
    name: 'VROC',
    processData: (indicator, candle) => {
      indicator.add(Number(candle.volume));
      const result = indicator.isStable ? indicator.getResult() : null;
      const signal = indicator.getSignal();
      return {result, signal, volume: Number(candle.volume)};
    },
    requiredInputs: 15,
    type: 'single',
    yAxisLabel: 'VROC %',
  },
  {
    chartTitle: 'Volume Weighted Moving Average (20)',
    color: '#6366f1',
    createIndicator: () => new VWMA(20),
    description: 'Volume Weighted Moving Average',
    details:
      'Similar to SMA but weights each price by its volume. High-volume bars have more influence. Uses a signal line (SMA by default) for crossover signals. When VWMA crosses above the signal line, it indicates bullish momentum.',
    getChartData: result => ({x: 0, y: result.result}),
    getTableColumns: () => [
      {header: 'Period', key: 'period'},
      {header: 'Date', key: 'date'},
      {className: 'text-slate-300 py-2 px-3', header: 'Close', key: 'close', render: val => `$${val.toFixed(2)}`},
      {className: 'text-slate-300 py-2 px-3', header: 'Volume', key: 'volume'},
      {className: 'text-white font-mono py-2 px-3', header: 'VWMA', key: 'result'},
      {className: 'py-2 px-3', header: 'Signal', key: 'signal', render: val => <SignalBadge signal={val} />},
    ],
    id: 'vwma',
    name: 'VWMA',
    processData: (indicator, candle) => {
      indicator.add({close: Number(candle.close), high: Number(candle.high), low: Number(candle.low), volume: Number(candle.volume)});
      const result = indicator.isStable ? indicator.getResult() : null;
      const signal = indicator.getSignal();
      return {close: Number(candle.close), result, signal, volume: Number(candle.volume)};
    },
    requiredInputs: 20,
    type: 'single',
    yAxisLabel: 'VWMA',
  },
];

export default function VolumeIndicators() {
  const [selectedIndicator, setSelectedIndicator] = useState<string>('ad');
  const [selectedDataset, setSelectedDataset] = useState<string>('uptrend');

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash && indicators.some(ind => ind.id === hash)) {
      setSelectedIndicator(hash);
    }
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (hash && indicators.some(ind => ind.id === hash)) {
        setSelectedIndicator(hash);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleIndicatorChange = (indicatorId: string) => {
    setSelectedIndicator(indicatorId);
    window.location.hash = indicatorId;
  };

  const renderIndicatorContent = () => {
    const config = indicators.find(ind => ind.id === selectedIndicator);
    const dataset = datasets.find(ds => ds.id === selectedDataset);
    if (!config || !dataset) return null;

    return renderSingleIndicator(config, dataset.candles);
  };

  return (
    <div className="flex gap-6">
      {/* Sidebar */}
      <aside className="w-64 shrink-0">
        <div className="sticky top-6 space-y-4">
          <DatasetSelector datasets={datasets} selectedDataset={selectedDataset} onDatasetChange={setSelectedDataset} />
          <IndicatorList
            indicators={indicators}
            selectedIndicator={selectedIndicator}
            onIndicatorChange={handleIndicatorChange}
          />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0">{renderIndicatorContent()}</main>
    </div>
  );
}
