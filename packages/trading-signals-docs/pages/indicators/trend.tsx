import {useEffect, useState} from 'react';
import {Chart as HighchartsChart} from '@highcharts/react';
import {ADX, DEMA, DMA, DX, EMA, PSAR, RMA, SMA, VWAP, WMA, WSMA} from 'trading-signals';
import {ChartDataPoint} from '../../components/Chart';
import {DatasetSelector} from '../../components/DatasetSelector';
import {IndicatorList} from '../../components/IndicatorList';
import {SignalBadge} from '../../components/SignalBadge';
import PriceChart, {PriceData} from '../../components/PriceChart';
import type {ExchangeCandle} from '@typedtrader/exchange';
import type {IndicatorConfig} from '../../utils/types';
import {datasets} from '../../utils/datasets';
import {collectPriceData, renderSingleIndicator} from '../../utils/renderUtils';
import {formatDate} from '../../utils/formatDate';

const indicators: IndicatorConfig[] = [
  {
    id: 'sma',
    name: 'SMA',
    description: 'Simple Moving Average',
    color: '#3b82f6',
    type: 'single',
    requiredInputs: 5,
    details:
      'Calculates the arithmetic mean of prices over a specified period. Smooths out price fluctuations to identify the trend direction.',
    createIndicator: () => new SMA(5),
    processData: (indicator, candle) => {
      indicator.add(Number(candle.close));
      const result = indicator.isStable ? indicator.getResult() : null;
      const signal = 'getSignal' in indicator ? indicator.getSignal() : {state: 'UNKNOWN', hasChanged: false};
      return {result, signal, close: Number(candle.close)};
    },
    getChartData: result => ({x: 0, y: result.result}),
    getTableColumns: () => [
      {header: 'Period', key: 'period'},
      {header: 'Date', key: 'date'},
      {header: 'Close', key: 'close', render: val => `$${val.toFixed(2)}`, className: 'text-slate-300 py-2 px-3'},
      {header: 'SMA', key: 'result', className: 'text-white font-mono py-2 px-3'},
      {header: 'Signal', key: 'signal', render: val => <SignalBadge signal={val} />, className: 'py-2 px-3'},
    ],
    chartTitle: 'SMA (5)',
    yAxisLabel: 'Price',
  },
  {
    id: 'ema',
    name: 'EMA',
    description: 'Exponential Moving Average',
    color: '#8b5cf6',
    type: 'single',
    requiredInputs: 5,
    details:
      'Gives more weight to recent prices, reacting faster to price changes than SMA. Popular for identifying short-term trends.',
    createIndicator: () => new EMA(5),
    processData: (indicator, candle) => {
      indicator.add(Number(candle.close));
      const result = indicator.isStable ? indicator.getResult() : null;
      const signal = 'getSignal' in indicator ? indicator.getSignal() : {state: 'UNKNOWN', hasChanged: false};
      return {result, signal, close: Number(candle.close)};
    },
    getChartData: result => ({x: 0, y: result.result}),
    getTableColumns: () => [
      {header: 'Period', key: 'period'},
      {header: 'Date', key: 'date'},
      {header: 'Close', key: 'close', render: val => `$${val.toFixed(2)}`, className: 'text-slate-300 py-2 px-3'},
      {header: 'EMA', key: 'result', className: 'text-white font-mono py-2 px-3'},
      {header: 'Signal', key: 'signal', render: val => <SignalBadge signal={val} />, className: 'py-2 px-3'},
    ],
    chartTitle: 'EMA (5)',
    yAxisLabel: 'Price',
  },
  {
    id: 'dema',
    name: 'DEMA',
    description: 'Double Exponential Moving Average',
    color: '#ec4899',
    type: 'single',
    requiredInputs: 9,
    details:
      'Reduces lag by applying EMA twice, providing faster signals than standard EMA while maintaining smoothness.',
    createIndicator: () => new DEMA(5),
    processData: (indicator, candle) => {
      indicator.add(Number(candle.close));
      const result = indicator.isStable ? indicator.getResult() : null;
      const signal = 'getSignal' in indicator ? indicator.getSignal() : {state: 'UNKNOWN', hasChanged: false};
      return {result, signal, close: Number(candle.close)};
    },
    getChartData: result => ({x: 0, y: result.result}),
    getTableColumns: () => [
      {header: 'Period', key: 'period'},
      {header: 'Date', key: 'date'},
      {header: 'Close', key: 'close', render: val => `$${val.toFixed(2)}`, className: 'text-slate-300 py-2 px-3'},
      {header: 'DEMA', key: 'result', className: 'text-white font-mono py-2 px-3'},
      {header: 'Signal', key: 'signal', render: val => <SignalBadge signal={val} />, className: 'py-2 px-3'},
    ],
    chartTitle: 'DEMA (5)',
    yAxisLabel: 'Price',
  },
  {
    id: 'wma',
    name: 'WMA',
    description: 'Weighted Moving Average',
    color: '#10b981',
    type: 'single',
    requiredInputs: 5,
    details: 'Assigns linearly increasing weights to recent data points. The most recent price has the highest weight.',
    createIndicator: () => new WMA(5),
    processData: (indicator, candle) => {
      indicator.add(Number(candle.close));
      const result = indicator.isStable ? indicator.getResult() : null;
      const signal = 'getSignal' in indicator ? indicator.getSignal() : {state: 'UNKNOWN', hasChanged: false};
      return {result, signal, close: Number(candle.close)};
    },
    getChartData: result => ({x: 0, y: result.result}),
    getTableColumns: () => [
      {header: 'Period', key: 'period'},
      {header: 'Date', key: 'date'},
      {header: 'Close', key: 'close', render: val => `$${val.toFixed(2)}`, className: 'text-slate-300 py-2 px-3'},
      {header: 'WMA', key: 'result', className: 'text-white font-mono py-2 px-3'},
      {header: 'Signal', key: 'signal', render: val => <SignalBadge signal={val} />, className: 'py-2 px-3'},
    ],
    chartTitle: 'WMA (5)',
    yAxisLabel: 'Price',
  },
  {
    id: 'rma',
    name: 'RMA',
    description: "Relative Moving Average (Wilder's MA)",
    color: '#f59e0b',
    type: 'single',
    requiredInputs: 5,
    details:
      'Developed by J. Welles Wilder Jr., this smoothed moving average gives more weight to historical data, resulting in a smoother line.',
    createIndicator: () => new RMA(5),
    processData: (indicator, candle) => {
      indicator.add(Number(candle.close));
      const result = indicator.isStable ? indicator.getResult() : null;
      const signal = 'getSignal' in indicator ? indicator.getSignal() : {state: 'UNKNOWN', hasChanged: false};
      return {result, signal, close: Number(candle.close)};
    },
    getChartData: result => ({x: 0, y: result.result}),
    getTableColumns: () => [
      {header: 'Period', key: 'period'},
      {header: 'Date', key: 'date'},
      {header: 'Close', key: 'close', render: val => `$${val.toFixed(2)}`, className: 'text-slate-300 py-2 px-3'},
      {header: 'RMA', key: 'result', className: 'text-white font-mono py-2 px-3'},
      {header: 'Signal', key: 'signal', render: val => <SignalBadge signal={val} />, className: 'py-2 px-3'},
    ],
    chartTitle: 'RMA (5)',
    yAxisLabel: 'Price',
  },
  {
    id: 'wsma',
    name: 'WSMA',
    description: "Wilder's Smoothed Moving Average",
    color: '#06b6d4',
    type: 'single',
    requiredInputs: 5,
    details:
      'Similar to RMA, this is a smoothed moving average that reduces noise and provides a clearer view of the trend.',
    createIndicator: () => new WSMA(5),
    processData: (indicator, candle) => {
      indicator.add(Number(candle.close));
      const result = indicator.isStable ? indicator.getResult() : null;
      const signal = 'getSignal' in indicator ? indicator.getSignal() : {state: 'UNKNOWN', hasChanged: false};
      return {result, signal, close: Number(candle.close)};
    },
    getChartData: result => ({x: 0, y: result.result}),
    getTableColumns: () => [
      {header: 'Period', key: 'period'},
      {header: 'Date', key: 'date'},
      {header: 'Close', key: 'close', render: val => `$${val.toFixed(2)}`, className: 'text-slate-300 py-2 px-3'},
      {header: 'WSMA', key: 'result', className: 'text-white font-mono py-2 px-3'},
      {header: 'Signal', key: 'signal', render: val => <SignalBadge signal={val} />, className: 'py-2 px-3'},
    ],
    chartTitle: 'WSMA (5)',
    yAxisLabel: 'Price',
  },
  {
    id: 'vwap',
    name: 'VWAP',
    description: 'Volume Weighted Average Price',
    color: '#ef4444',
    type: 'single',
    requiredInputs: 1,
    details:
      'Calculates the average price weighted by volume. Used to assess whether trades are being executed at favorable prices.',
    createIndicator: () => new VWAP(),
    processData: (indicator, candle) => {
      indicator.add({high: Number(candle.high), low: Number(candle.low), close: Number(candle.close), volume: Number(candle.volume)});
      const result = indicator.getResult();
      const signal = 'getSignal' in indicator ? indicator.getSignal() : {state: 'UNKNOWN', hasChanged: false};
      return {result, signal, close: Number(candle.close), volume: Number(candle.volume)};
    },
    getChartData: result => ({x: 0, y: result.result}),
    getTableColumns: () => [
      {header: 'Period', key: 'period'},
      {header: 'Date', key: 'date'},
      {header: 'Close', key: 'close', render: val => `$${val.toFixed(2)}`, className: 'text-slate-300 py-2 px-3'},
      {header: 'Volume', key: 'volume', className: 'text-slate-300 py-2 px-3'},
      {header: 'VWAP', key: 'result', className: 'text-white font-mono py-2 px-3'},
      {header: 'Signal', key: 'signal', render: val => <SignalBadge signal={val} />, className: 'py-2 px-3'},
    ],
    chartTitle: 'VWAP',
    yAxisLabel: 'Price',
  },
  {
    id: 'adx',
    name: 'ADX',
    description: 'Average Directional Index',
    color: '#a855f7',
    type: 'single',
    requiredInputs: 14,
    details:
      'Measures trend strength regardless of direction. Values above 25 indicate a strong trend, below 20 suggest a weak trend.',
    createIndicator: () => new ADX(14),
    processData: (indicator, candle) => {
      indicator.add({high: Number(candle.high), low: Number(candle.low), close: Number(candle.close)});
      const result = indicator.isStable ? indicator.getResult() : null;
      const signal = 'getSignal' in indicator ? indicator.getSignal() : {state: 'UNKNOWN', hasChanged: false};
      return {result, signal, high: Number(candle.high), low: Number(candle.low), close: Number(candle.close)};
    },
    getChartData: result => ({x: 0, y: result.result}),
    getTableColumns: () => [
      {header: 'Period', key: 'period'},
      {header: 'Date', key: 'date'},
      {header: 'High', key: 'high', render: val => `$${val.toFixed(2)}`, className: 'text-slate-300 py-2 px-3'},
      {header: 'Low', key: 'low', render: val => `$${val.toFixed(2)}`, className: 'text-slate-300 py-2 px-3'},
      {header: 'Close', key: 'close', render: val => `$${val.toFixed(2)}`, className: 'text-slate-300 py-2 px-3'},
      {header: 'ADX', key: 'result', className: 'text-white font-mono py-2 px-3'},
      {header: 'Signal', key: 'signal', render: val => <SignalBadge signal={val} />, className: 'py-2 px-3'},
    ],
    chartTitle: 'ADX (14)',
    yAxisLabel: 'ADX',
  },
  {
    id: 'dx',
    name: 'DX',
    description: 'Directional Movement Index',
    color: '#84cc16',
    type: 'single',
    requiredInputs: 14,
    details:
      'Measures the strength of directional movement. The ADX is derived from smoothing the DX values over time.',
    createIndicator: () => new DX(14),
    processData: (indicator, candle) => {
      indicator.add({high: Number(candle.high), low: Number(candle.low), close: Number(candle.close)});
      const result = indicator.isStable ? indicator.getResult() : null;
      const signal = 'getSignal' in indicator ? indicator.getSignal() : {state: 'UNKNOWN', hasChanged: false};
      return {result, signal, high: Number(candle.high), low: Number(candle.low), close: Number(candle.close)};
    },
    getChartData: result => ({x: 0, y: result.result}),
    getTableColumns: () => [
      {header: 'Period', key: 'period'},
      {header: 'Date', key: 'date'},
      {header: 'High', key: 'high', render: val => `$${val.toFixed(2)}`, className: 'text-slate-300 py-2 px-3'},
      {header: 'Low', key: 'low', render: val => `$${val.toFixed(2)}`, className: 'text-slate-300 py-2 px-3'},
      {header: 'Close', key: 'close', render: val => `$${val.toFixed(2)}`, className: 'text-slate-300 py-2 px-3'},
      {header: 'DX', key: 'result', className: 'text-white font-mono py-2 px-3'},
      {header: 'Signal', key: 'signal', render: val => <SignalBadge signal={val} />, className: 'py-2 px-3'},
    ],
    chartTitle: 'DX (14)',
    yAxisLabel: 'DX',
  },
  {
    id: 'psar',
    name: 'PSAR',
    description: 'Parabolic SAR',
    color: '#f97316',
    type: 'single',
    requiredInputs: 2,
    details:
      'Identifies potential reversal points by placing dots above or below price. Dots below = uptrend, dots above = downtrend.',
    createIndicator: () => new PSAR({accelerationStep: 0.02, accelerationMax: 0.2}),
    processData: (indicator, candle) => {
      indicator.add({high: Number(candle.high), low: Number(candle.low), close: Number(candle.close)});
      const result = indicator.isStable ? indicator.getResult() : null;
      const signal = 'getSignal' in indicator ? indicator.getSignal() : {state: 'UNKNOWN', hasChanged: false};
      return {result, signal, high: Number(candle.high), low: Number(candle.low), close: Number(candle.close)};
    },
    getChartData: result => ({x: 0, y: result.result}),
    getTableColumns: () => [
      {header: 'Period', key: 'period'},
      {header: 'Date', key: 'date'},
      {header: 'High', key: 'high', render: val => `$${val.toFixed(2)}`, className: 'text-slate-300 py-2 px-3'},
      {header: 'Low', key: 'low', render: val => `$${val.toFixed(2)}`, className: 'text-slate-300 py-2 px-3'},
      {header: 'Close', key: 'close', render: val => `$${val.toFixed(2)}`, className: 'text-slate-300 py-2 px-3'},
      {header: 'PSAR', key: 'result', className: 'text-white font-mono py-2 px-3'},
      {header: 'Signal', key: 'signal', render: val => <SignalBadge signal={val} />, className: 'py-2 px-3'},
    ],
    chartTitle: 'Parabolic SAR',
    yAxisLabel: 'Price',
  },
  {
    id: 'dma',
    name: 'DMA',
    description: 'Dual Moving Average',
    color: '#22d3ee',
    type: 'custom',
    requiredInputs: 9,
    details:
      'Compares two moving averages. When the short MA crosses above the long MA, it signals a potential buy opportunity.',
    createIndicator: () => new DMA(5, 9, SMA),
    processData: () => ({}),
    getChartData: () => ({x: 0, y: null}),
    getTableColumns: () => [],
  },
];

const renderDMA = (config: IndicatorConfig, selectedCandles: ExchangeCandle[]) => {
  const dma = new DMA(5, 9, SMA);
  const chartDataShort: ChartDataPoint[] = [];
  const chartDataLong: ChartDataPoint[] = [];
  const priceData: PriceData[] = [];
  const sampleValues: Array<{
    period: number;
    date: string;
    close: number;
    short: string;
    long: string;
    signal: string;
  }> = [];

  selectedCandles.forEach((candle, idx) => {
    dma.add(Number(candle.close));
    const result = dma.isStable ? dma.getResult() : null;
    const signal =
      'getSignal' in dma
        ? (dma.getSignal as () => {state: string; hasChanged: boolean})()
        : {state: 'UNKNOWN', hasChanged: false};
    chartDataShort.push({x: idx + 1, y: result?.short ?? null});
    chartDataLong.push({x: idx + 1, y: result?.long ?? null});

    priceData.push(collectPriceData(candle, idx));

    sampleValues.push({
      period: idx + 1,
      date: formatDate(candle.openTimeInISO),
      close: Number(candle.close),
      short: result ? result.short.toFixed(2) : 'N/A',
      long: result ? result.long.toFixed(2) : 'N/A',
      signal: signal.state,
    });
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2 select-text">
          DMA(5, 9) / Required Inputs: {dma.getRequiredInputs()}
        </h2>
        <p className="text-slate-300 select-text">{config.description}</p>
        {config.details && <p className="text-slate-400 text-sm mt-2 select-text">{config.details}</p>}
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
        <HighchartsChart
          options={{
            chart: {
              type: 'line',
              backgroundColor: 'transparent',
              height: 300,
            },
            title: {
              text: 'Dual Moving Average (5,9)',
              style: {
                color: '#e2e8f0',
                fontSize: '16px',
                fontWeight: '600',
              },
            },
            credits: {
              enabled: false,
            },
            xAxis: {
              title: {
                text: 'Period',
                style: {color: '#94a3b8'},
              },
              labels: {
                style: {color: '#94a3b8'},
              },
              gridLineColor: '#334155',
            },
            yAxis: {
              title: {
                text: 'Price',
                style: {color: '#94a3b8'},
              },
              labels: {
                style: {color: '#94a3b8'},
              },
              gridLineColor: '#334155',
            },
            legend: {
              enabled: true,
              itemStyle: {
                color: '#e2e8f0',
              },
            },
            plotOptions: {
              line: {
                marker: {
                  enabled: true,
                  radius: 3,
                },
                lineWidth: 2,
              },
            },
            series: [
              {
                type: 'line',
                name: 'Short MA (5)',
                data: chartDataShort.map(point => [point.x, point.y]),
                color: config.color,
                marker: {
                  fillColor: config.color,
                },
              },
              {
                type: 'line',
                name: 'Long MA (9)',
                data: chartDataLong.map(point => [point.x, point.y]),
                color: '#f97316',
                marker: {
                  fillColor: '#f97316',
                },
              },
            ],
            tooltip: {
              backgroundColor: '#1e293b',
              borderColor: '#475569',
              style: {
                color: '#e2e8f0',
              },
              shared: true,
              formatter: function (): string {
                let s: string = `<b>Period ${(this as any).x}</b><br/>`;
                ((this as any).points as any[])?.forEach((point: any) => {
                  const yValue = typeof point.y === 'number' ? point.y.toFixed(2) : 'N/A';
                  s += `${point.series.name}: ${yValue}<br/>`;
                });
                return s;
              },
            },
          }}
        />
      </div>

      <PriceChart title="Input Prices" data={priceData} />

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-3">All Sample Values</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-600">
                <th className="text-left py-2 px-3 text-slate-400 font-medium">Period</th>
                <th className="text-left py-2 px-3 text-slate-400 font-medium">Date</th>
                <th className="text-left py-2 px-3 text-slate-400 font-medium">Close</th>
                <th className="text-left py-2 px-3 text-slate-400 font-medium">Short MA</th>
                <th className="text-left py-2 px-3 text-slate-400 font-medium">Long MA</th>
                <th className="text-left py-2 px-3 text-slate-400 font-medium">Signal</th>
              </tr>
            </thead>
            <tbody>
              {sampleValues.map((row, idx) => (
                <tr key={idx} className="border-b border-slate-700/50">
                  <td className="py-2 px-3 text-white font-mono">{row.period}</td>
                  <td className="py-2 px-3 text-slate-300">{row.date}</td>
                  <td className="py-2 px-3 text-slate-300">${row.close.toFixed(2)}</td>
                  <td className="py-2 px-3 text-white font-mono">{row.short}</td>
                  <td className="py-2 px-3 text-white font-mono">{row.long}</td>
                  <td className="py-2 px-3">
                    <SignalBadge signal={row.signal} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default function TrendIndicators() {
  const [selectedIndicator, setSelectedIndicator] = useState<string>('sma');
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

    if (config.type === 'single') {
      return renderSingleIndicator(config, dataset.candles);
    }

    switch (selectedIndicator) {
      case 'dma':
        return renderDMA(config, dataset.candles);
      default:
        return null;
    }
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
