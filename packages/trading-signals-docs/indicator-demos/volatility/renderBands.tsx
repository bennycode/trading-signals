import {Chart as HighchartsChart} from '@highcharts/react';
import type {ReactNode} from 'react';
import type {ExchangeCandle} from '@typedtrader/exchange';
import type {ChartDataPoint} from '../../components/Chart';
import {NotAvailable} from '../../components/NotAvailable';
import PriceChart, {type PriceData} from '../../components/PriceChart';
import {SignalBadge} from '../../components/SignalBadge';
import {formatDate} from '../../utils/formatDate';
import {collectPriceData} from '../../utils/renderUtils';
import type {IndicatorConfig} from '../../utils/types';

export interface BandsOptions {
  label: string;
  paramString: string;
  createIndicator: () => any;
  addCandle: (indicator: any, candle: ExchangeCandle) => void;
  details: string;
}

export const renderBands = (config: IndicatorConfig, selectedCandles: ExchangeCandle[], options: BandsOptions) => {
  const indicator = options.createIndicator();
  const chartDataUpper: ChartDataPoint[] = [];
  const chartDataMiddle: ChartDataPoint[] = [];
  const chartDataLower: ChartDataPoint[] = [];
  const priceData: PriceData[] = [];
  const sampleValues: Array<{
    period: number;
    date: string;
    close: number;
    upper: ReactNode;
    middle: ReactNode;
    lower: ReactNode;
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
      date: formatDate(candle.openTimeInISO),
      close: Number(candle.close),
      upper: result ? result.upper.toFixed(2) : <NotAvailable />,
      middle: result ? result.middle.toFixed(2) : <NotAvailable />,
      lower: result ? result.lower.toFixed(2) : <NotAvailable />,
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
            chart: {type: 'line', backgroundColor: 'transparent', height: 300},
            title: {text: `${options.label} (${options.paramString})`, style: {color: '#e2e8f0', fontSize: '16px', fontWeight: '600'}},
            credits: {enabled: false},
            xAxis: {
              title: {text: 'Period', style: {color: '#94a3b8'}},
              labels: {style: {color: '#94a3b8'}},
              gridLineColor: '#334155',
            },
            yAxis: {
              title: {text: 'Price', style: {color: '#94a3b8'}},
              labels: {style: {color: '#94a3b8'}},
              gridLineColor: '#334155',
            },
            legend: {enabled: true, itemStyle: {color: '#e2e8f0'}},
            plotOptions: {line: {marker: {enabled: true, radius: 3}, lineWidth: 2}},
            series: [
              {
                type: 'line',
                name: 'Upper',
                data: chartDataUpper.map(point => [point.x, point.y]),
                color: '#ef4444',
                marker: {fillColor: '#ef4444'},
              },
              {
                type: 'line',
                name: 'Middle',
                data: chartDataMiddle.map(point => [point.x, point.y]),
                color: config.color,
                marker: {fillColor: config.color},
              },
              {
                type: 'line',
                name: 'Lower',
                data: chartDataLower.map(point => [point.x, point.y]),
                color: '#10b981',
                marker: {fillColor: '#10b981'},
              },
            ],
            tooltip: {
              backgroundColor: '#1e293b',
              borderColor: '#475569',
              style: {color: '#e2e8f0'},
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
