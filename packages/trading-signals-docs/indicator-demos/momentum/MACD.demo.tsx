import {Chart as HighchartsChart} from '@highcharts/react';
import {EMA, MACD as MACDClass} from 'trading-signals';
import type {ReactNode} from 'react';
import type {Candle} from '@typedtrader/exchange';
import type {ChartDataPoint} from '../../components/Chart';
import {NotAvailable} from '../../components/NotAvailable';
import PriceChart, {type PriceData} from '../../components/PriceChart';
import {SignalBadge} from '../../components/SignalBadge';
import {formatDate} from '../../utils/formatDate';
import {collectPriceData} from '../../utils/renderUtils';
import type {IndicatorConfig} from '../../utils/types';

const renderMACD = (config: IndicatorConfig, selectedCandles: Candle[]) => {
  const macd = new MACDClass(new EMA(12), new EMA(26), new EMA(9));
  const chartDataMACD: ChartDataPoint[] = [];
  const chartDataSignal: ChartDataPoint[] = [];
  const chartDataHistogram: ChartDataPoint[] = [];
  const priceData: PriceData[] = [];
  const sampleValues: {period: number; date: string; close: number; result: ReactNode; signal: string}[] = [];

  selectedCandles.forEach((candle, idx) => {
    macd.add(Number(candle.close));
    const result = macd.isStable ? macd.getResult() : null;
    const trendSignal = macd.getSignal();
    chartDataMACD.push({x: idx + 1, y: result?.macd ?? null});
    chartDataSignal.push({x: idx + 1, y: result?.signal ?? null});
    chartDataHistogram.push({x: idx + 1, y: result?.histogram ?? null});

    priceData.push(collectPriceData(candle, idx));

    sampleValues.push({
      close: Number(candle.close),
      date: formatDate(candle.openTimeInISO),
      period: idx + 1,
      result: result ? `${result.macd.toFixed(4)}` : <NotAvailable />,
      signal: trendSignal.state,
    });
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2 select-text">
          MACD(12, 26, 9) / Required Inputs: {macd.getRequiredInputs()}
        </h2>
        <p className="text-slate-300 select-text">{config.description}</p>
        <p className="text-slate-400 text-sm mt-2 select-text">
          Shows relationship between two moving averages. Crossing above signal line = bullish, crossing below =
          bearish.
        </p>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
        <HighchartsChart
          options={{
            chart: {backgroundColor: 'transparent', height: 300, type: 'line'},
            credits: {enabled: false},
            legend: {enabled: true, itemStyle: {color: '#e2e8f0'}},
            plotOptions: {
              column: {borderWidth: 0},
              line: {lineWidth: 2, marker: {enabled: true, radius: 3}},
            },
            series: [
              {
                color: config.color,
                data: chartDataMACD.map(point => [point.x, point.y]),
                marker: {fillColor: config.color},
                name: 'MACD',
                type: 'line',
              },
              {
                color: '#f97316',
                data: chartDataSignal.map(point => [point.x, point.y]),
                marker: {fillColor: '#f97316'},
                name: 'Signal',
                type: 'line',
              },
              {
                color: '#6366f1',
                data: chartDataHistogram.map(point => [point.x, point.y]),
                name: 'Histogram',
                opacity: 0.5,
                type: 'column',
              },
            ],
            title: {style: {color: '#e2e8f0', fontSize: '16px', fontWeight: '600'}, text: 'MACD (12,26,9)'},
            tooltip: {
              backgroundColor: '#1e293b',
              borderColor: '#475569',
              formatter: function () {
                let s: string = `<b>Period ${(this as any).x}</b><br/>`;
                ((this as any).points as any[])?.forEach((point: any) => {
                  const yValue = typeof point.y === 'number' ? point.y.toFixed(4) : 'N/A';
                  s += `${point.series.name}: ${yValue}<br/>`;
                });
                return s;
              },
              shared: true,
              style: {color: '#e2e8f0'},
            },
            xAxis: {
              gridLineColor: '#334155',
              labels: {style: {color: '#94a3b8'}},
              title: {style: {color: '#94a3b8'}, text: 'Period'},
            },
            yAxis: {
              gridLineColor: '#334155',
              labels: {style: {color: '#94a3b8'}},
              title: {style: {color: '#94a3b8'}, text: 'Value'},
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
                <th className="text-left text-slate-300 py-2 px-3">Period</th>
                <th className="text-left text-slate-300 py-2 px-3">Date</th>
                <th className="text-left text-slate-300 py-2 px-3">Close</th>
                <th className="text-left text-slate-300 py-2 px-3">MACD</th>
                <th className="text-left text-slate-300 py-2 px-3">Signal</th>
              </tr>
            </thead>
            <tbody>
              {sampleValues.map(row => (
                <tr key={row.period} className="border-b border-slate-700/50">
                  <td className="text-slate-400 py-2 px-3">{row.period}</td>
                  <td className="text-slate-300 py-2 px-3">{row.date}</td>
                  <td className="text-slate-300 py-2 px-3">${row.close.toFixed(2)}</td>
                  <td className="text-white font-mono py-2 px-3">{row.result}</td>
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

export const MACD: IndicatorConfig = {
  color: '#3b82f6',
  createIndicator: () => new MACDClass(new EMA(12), new EMA(26), new EMA(9)),
  customRender: renderMACD,
  description: 'Moving Average Convergence Divergence',
  id: 'macd',
  name: 'MACD',
  requiredInputs: 33,
  type: 'custom',
};
