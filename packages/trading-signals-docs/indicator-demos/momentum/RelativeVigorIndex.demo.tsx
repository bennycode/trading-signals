import {Chart as HighchartsChart} from '@highcharts/react';
import {RelativeVigorIndex} from 'trading-signals';
import type {ReactNode} from 'react';
import type {Candle} from '@typedtrader/exchange';
import {createSharedTooltipFormatter, type ChartDataPoint} from '../../components/Chart';
import {NotAvailable} from '../../components/NotAvailable';
import PriceChart, {type PriceData} from '../../components/PriceChart';
import {SignalBadge} from '../../components/SignalBadge';
import {formatDate} from '../../utils/formatDate';
import {collectPriceData} from '../../utils/renderUtils';
import type {IndicatorConfig} from '../../utils/types';

const renderRVGI = (config: IndicatorConfig, selectedCandles: Candle[]) => {
  const rvgi = new RelativeVigorIndex(10);
  const chartDataRVGI: ChartDataPoint[] = [];
  const chartDataSignal: ChartDataPoint[] = [];
  const priceData: PriceData[] = [];
  const sampleValues: {period: number; date: string; close: number; result: ReactNode; signal: string}[] = [];

  selectedCandles.forEach((candle, idx) => {
    rvgi.add({
      close: Number(candle.close),
      high: Number(candle.high),
      low: Number(candle.low),
      open: Number(candle.open),
    });
    const result = rvgi.isStable ? rvgi.getResult() : null;
    const trendSignal = rvgi.getSignal();
    chartDataRVGI.push({x: idx + 1, y: result?.rvgi ?? null});
    chartDataSignal.push({x: idx + 1, y: result?.signal ?? null});

    priceData.push(collectPriceData(candle, idx));

    sampleValues.push({
      close: Number(candle.close),
      date: formatDate(candle.openTimeInISO),
      period: idx + 1,
      result: result ? `${result.rvgi.toFixed(4)}` : <NotAvailable />,
      signal: trendSignal.state,
    });
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2 select-text">
          RVGI(10) / Required Inputs: {rvgi.getRequiredInputs()}
        </h2>
        <p className="text-slate-300 select-text">{config.description}</p>
        <p className="text-slate-400 text-sm mt-2 select-text">
          Measures how much of the trading range the closes captured. Index above its signal line = bullish, below =
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
              line: {lineWidth: 2, marker: {enabled: true, radius: 3}},
            },
            series: [
              {
                color: config.color,
                data: chartDataRVGI.map(point => [point.x, point.y]),
                marker: {fillColor: config.color},
                name: 'RVGI',
                type: 'line',
              },
              {
                color: '#f97316',
                data: chartDataSignal.map(point => [point.x, point.y]),
                marker: {fillColor: '#f97316'},
                name: 'Signal',
                type: 'line',
              },
            ],
            title: {style: {color: '#e2e8f0', fontSize: '16px', fontWeight: '600'}, text: 'Relative Vigor Index (10)'},
            tooltip: {
              backgroundColor: '#1e293b',
              borderColor: '#475569',
              formatter: createSharedTooltipFormatter(y => y.toFixed(4)),
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
                <th className="text-left text-slate-300 py-2 px-3">RVGI</th>
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

export const RVGI: IndicatorConfig = {
  color: '#14b8a6',
  createIndicator: () => new RelativeVigorIndex(10),
  customRender: renderRVGI,
  description: 'Relative Vigor Index',
  id: 'rvgi',
  name: 'RVGI',
  requiredInputs: 16,
  type: 'custom',
};
