import {useEffect, useState} from 'react';
import {Chart as HighchartsChart} from '@highcharts/react';
import {AccelerationBands, ATR, BollingerBands, BollingerBandsWidth, IQR, MAD, TR} from 'trading-signals';
import {ChartDataPoint} from '../../components/Chart';
import {DatasetSelector} from '../../components/DatasetSelector';
import {IndicatorList} from '../../components/IndicatorList';
import {SignalBadge} from '../../components/SignalBadge';
import PriceChart, {PriceData} from '../../components/PriceChart';
import type {Candle, IndicatorConfig} from '../../utils/types';
import {datasets} from '../../utils/datasets';
import {collectPriceData, renderSingleIndicator} from '../../utils/renderUtils';

const indicators: IndicatorConfig[] = [
  {
    id: 'bbands',
    name: 'Bollinger Bands',
    description: 'Bollinger Bands',
    color: '#3b82f6',
    type: 'custom',
    requiredInputs: 20,
    createIndicator: () => new BollingerBands(20, 2),
    processData: () => ({}),
    getChartData: () => ({x: 0, y: null}),
    getTableColumns: () => [],
  },
  {
    id: 'abands',
    name: 'ABANDS',
    description: 'Acceleration Bands',
    color: '#8b5cf6',
    type: 'custom',
    requiredInputs: 20,
    createIndicator: () => new AccelerationBands(20, 4),
    processData: () => ({}),
    getChartData: () => ({x: 0, y: null}),
    getTableColumns: () => [],
  },
  {
    id: 'atr',
    name: 'ATR',
    description: 'Average True Range',
    color: '#f59e0b',
    type: 'single',
    requiredInputs: 14,
    details:
      'Measures market volatility by analyzing the range of price movements. Higher values indicate higher volatility; useful for setting stop-loss levels.',
    createIndicator: () => new ATR(14),
    processData: (indicator, candle) => {
      indicator.add({high: candle.high, low: candle.low, close: candle.close});
      const result = indicator.isStable ? indicator.getResult() : null;
      const signal = 'getSignal' in indicator ? indicator.getSignal() : {state: 'UNKNOWN', hasChanged: false};
      return {result, signal, close: candle.close};
    },
    getChartData: result => ({x: 0, y: result.result}),
    getTableColumns: () => [
      {header: 'Period', key: 'period'},
      {header: 'Date', key: 'date'},
      {header: 'Close', key: 'close', render: (val: number) => `$${val.toFixed(2)}`, className: 'text-slate-300 py-2 px-3'},
      {header: 'ATR', key: 'result', className: 'text-white font-mono py-2 px-3'},
      {header: 'Signal', key: 'signal', render: (val: string) => <SignalBadge signal={val} />, className: 'py-2 px-3'},
    ],
    chartTitle: 'ATR (14)',
    yAxisLabel: 'ATR',
  },
  {
    id: 'tr',
    name: 'TR',
    description: 'True Range',
    color: '#ec4899',
    type: 'single',
    requiredInputs: 2,
    details:
      'Measures the greatest of: current high minus current low, absolute value of current high minus previous close, or absolute value of current low minus previous close. Low values indicate a sideways trend with little volatility.',
    createIndicator: () => new TR(),
    processData: (indicator, candle) => {
      indicator.add({high: candle.high, low: candle.low, close: candle.close});
      const result = indicator.isStable ? indicator.getResult() : null;
      const signal = 'getSignal' in indicator ? indicator.getSignal() : {state: 'UNKNOWN', hasChanged: false};
      return {result, signal, close: candle.close};
    },
    getChartData: result => ({x: 0, y: result.result}),
    getTableColumns: () => [
      {header: 'Period', key: 'period'},
      {header: 'Date', key: 'date'},
      {header: 'Close', key: 'close', render: (val: number) => `$${val.toFixed(2)}`, className: 'text-slate-300 py-2 px-3'},
      {header: 'TR', key: 'result', className: 'text-white font-mono py-2 px-3'},
      {header: 'Signal', key: 'signal', render: (val: string) => <SignalBadge signal={val} />, className: 'py-2 px-3'},
    ],
    chartTitle: 'True Range',
    yAxisLabel: 'TR',
  },
  {
    id: 'bbw',
    name: 'BBW',
    description: 'Bollinger Bands Width',
    color: '#10b981',
    type: 'single',
    requiredInputs: 20,
    details:
      'Measures the width between the upper and lower Bollinger Bands relative to the middle band. Useful for identifying squeezes and potential breakouts.',
    createIndicator: () => new BollingerBandsWidth(new BollingerBands(20, 2)),
    processData: (indicator, candle) => {
      indicator.add(candle.close);
      const result = indicator.isStable ? indicator.getResult() : null;
      const signal = 'getSignal' in indicator ? indicator.getSignal() : {state: 'UNKNOWN', hasChanged: false};
      return {result, signal, close: candle.close};
    },
    getChartData: result => ({x: 0, y: result.result}),
    getTableColumns: () => [
      {header: 'Period', key: 'period'},
      {header: 'Date', key: 'date'},
      {header: 'Close', key: 'close', render: (val: number) => `$${val.toFixed(2)}`, className: 'text-slate-300 py-2 px-3'},
      {header: 'BBW', key: 'result', className: 'text-white font-mono py-2 px-3'},
      {header: 'Signal', key: 'signal', render: (val: string) => <SignalBadge signal={val} />, className: 'py-2 px-3'},
    ],
    chartTitle: 'BBW (20, 2)',
    yAxisLabel: 'BBW',
  },
  {
    id: 'iqr',
    name: 'IQR',
    description: 'Interquartile Range',
    color: '#6366f1',
    type: 'single',
    requiredInputs: 13,
    details:
      'Statistical measure of variability showing the middle 50% of data. Robust measure of spread that is less sensitive to outliers than standard deviation.',
    createIndicator: () => new IQR(13),
    processData: (indicator, candle) => {
      indicator.add(candle.close);
      const result = indicator.isStable ? indicator.getResult() : null;
      const signal = 'getSignal' in indicator ? indicator.getSignal() : {state: 'UNKNOWN', hasChanged: false};
      return {result, signal, close: candle.close};
    },
    getChartData: result => ({x: 0, y: result.result}),
    getTableColumns: () => [
      {header: 'Period', key: 'period'},
      {header: 'Date', key: 'date'},
      {header: 'Close', key: 'close', render: (val: number) => `$${val.toFixed(2)}`, className: 'text-slate-300 py-2 px-3'},
      {header: 'IQR', key: 'result', className: 'text-white font-mono py-2 px-3'},
      {header: 'Signal', key: 'signal', render: (val: string) => <SignalBadge signal={val} />, className: 'py-2 px-3'},
    ],
    chartTitle: 'IQR (13)',
    yAxisLabel: 'IQR',
  },
  {
    id: 'mad',
    name: 'MAD',
    description: 'Mean Absolute Deviation',
    color: '#ef4444',
    type: 'single',
    requiredInputs: 10,
    details:
      'Average absolute deviation from the mean. Measures the average distance between each data point and the mean of the dataset.',
    createIndicator: () => new MAD(10),
    processData: (indicator, candle) => {
      indicator.add(candle.close);
      const result = indicator.isStable ? indicator.getResult() : null;
      const signal = 'getSignal' in indicator ? indicator.getSignal() : {state: 'UNKNOWN', hasChanged: false};
      return {result, signal, close: candle.close};
    },
    getChartData: result => ({x: 0, y: result.result}),
    getTableColumns: () => [
      {header: 'Period', key: 'period'},
      {header: 'Date', key: 'date'},
      {header: 'Close', key: 'close', render: (val: number) => `$${val.toFixed(2)}`, className: 'text-slate-300 py-2 px-3'},
      {header: 'MAD', key: 'result', className: 'text-white font-mono py-2 px-3'},
      {header: 'Signal', key: 'signal', render: (val: string) => <SignalBadge signal={val} />, className: 'py-2 px-3'},
    ],
    chartTitle: 'MAD (10)',
    yAxisLabel: 'MAD',
  },
];

const renderBands = (
  config: IndicatorConfig,
  selectedCandles: Candle[],
  options: {
    label: string;
    paramString: string;
    createIndicator: () => any;
    addCandle: (indicator: any, candle: Candle) => void;
    details: string;
  }
) => {
  const indicator = options.createIndicator();
  const chartDataUpper: ChartDataPoint[] = [];
  const chartDataMiddle: ChartDataPoint[] = [];
  const chartDataLower: ChartDataPoint[] = [];
  const priceData: PriceData[] = [];
  const sampleValues: Array<{
    period: number;
    date: string;
    close: number;
    upper: string;
    middle: string;
    lower: string;
    signal: string;
  }> = [];

  selectedCandles.forEach((candle, idx) => {
    options.addCandle(indicator, candle);
    const result = indicator.isStable ? indicator.getResult() : null;
    const signal =
      'getSignal' in indicator
        ? (indicator.getSignal as () => {state: string; hasChanged: boolean})()
        : {state: 'UNKNOWN', hasChanged: false};

    chartDataUpper.push({x: idx + 1, y: result?.upper ?? null});
    chartDataMiddle.push({x: idx + 1, y: result?.middle ?? null});
    chartDataLower.push({x: idx + 1, y: result?.lower ?? null});

    priceData.push(collectPriceData(candle, idx));

    sampleValues.push({
      period: idx + 1,
      date: candle.date,
      close: candle.close,
      upper: result ? result.upper.toFixed(2) : 'N/A',
      middle: result ? result.middle.toFixed(2) : 'N/A',
      lower: result ? result.lower.toFixed(2) : 'N/A',
      signal: signal.state,
    });
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2 select-text">
          {options.label}({options.paramString}) / Required Inputs: {indicator.getRequiredInputs()}
        </h2>
        <p className="text-slate-300 select-text">{config.description}</p>
        <p className="text-slate-400 text-sm mt-2 select-text">{options.details}</p>
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
              text: `${options.label} (${options.paramString})`,
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
                name: 'Upper',
                data: chartDataUpper.map(point => [point.x, point.y]),
                color: '#ef4444',
                marker: {
                  fillColor: '#ef4444',
                },
              },
              {
                type: 'line',
                name: 'Middle',
                data: chartDataMiddle.map(point => [point.x, point.y]),
                color: config.color,
                marker: {
                  fillColor: config.color,
                },
              },
              {
                type: 'line',
                name: 'Lower',
                data: chartDataLower.map(point => [point.x, point.y]),
                color: '#10b981',
                marker: {
                  fillColor: '#10b981',
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
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-600">
                <th className="text-left py-2 px-3 text-slate-400 font-medium">Period</th>
                <th className="text-left py-2 px-3 text-slate-400 font-medium">Date</th>
                <th className="text-left py-2 px-3 text-slate-400 font-medium">Close</th>
                <th className="text-left py-2 px-3 text-slate-400 font-medium">Upper</th>
                <th className="text-left py-2 px-3 text-slate-400 font-medium">Middle</th>
                <th className="text-left py-2 px-3 text-slate-400 font-medium">Lower</th>
                <th className="text-left py-2 px-3 text-slate-400 font-medium">Signal</th>
              </tr>
            </thead>
            <tbody>
              {sampleValues.map((row, idx) => (
                <tr key={idx} className="border-b border-slate-700/50">
                  <td className="py-2 px-3 text-white font-mono">{row.period}</td>
                  <td className="py-2 px-3 text-slate-300">{row.date}</td>
                  <td className="py-2 px-3 text-slate-300">${row.close.toFixed(2)}</td>
                  <td className="py-2 px-3 text-white font-mono">{row.upper}</td>
                  <td className="py-2 px-3 text-white font-mono">{row.middle}</td>
                  <td className="py-2 px-3 text-white font-mono">{row.lower}</td>
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

export default function VolatilityIndicators() {
  const [selectedIndicator, setSelectedIndicator] = useState<string>('bbands');
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
      case 'bbands':
        return renderBands(config, dataset.candles, {
          label: 'BollingerBands',
          paramString: '20, 2',
          createIndicator: () => new BollingerBands(20, 2),
          addCandle: (indicator, candle) => indicator.add(candle.close),
          details:
            'Shows price volatility using standard deviations from a moving average. Price touching the upper band may indicate overbought, touching lower band may indicate oversold.',
        });
      case 'abands':
        return renderBands(config, dataset.candles, {
          label: 'AccelerationBands',
          paramString: '20, 4',
          createIndicator: () => new AccelerationBands(20, 4),
          addCandle: (indicator, candle) => indicator.add({high: candle.high, low: candle.low, close: candle.close}),
          details:
            'Volatility bands based on price momentum. Two consecutive closes outside Acceleration Bands suggest an entry point in the direction of the breakout.',
        });
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
