import {Chart as HighchartsChart} from '@highcharts/react';
import {WaveTrend as WaveTrendClass} from 'trading-signals';
import type {ReactNode} from 'react';
import type {Candle} from '@typedtrader/exchange';
import {createSharedTooltipFormatter, type ChartDataPoint} from '../../components/Chart';
import {NotAvailable} from '../../components/NotAvailable';
import PriceChart, {type PriceData} from '../../components/PriceChart';
import {SignalBadge} from '../../components/SignalBadge';
import {formatDate} from '../../utils/formatDate';
import {collectPriceData} from '../../utils/renderUtils';
import type {IndicatorConfig} from '../../utils/types';

const renderWaveTrend = (config: IndicatorConfig, selectedCandles: Candle[]) => {
  const wt = new WaveTrendClass();
  const chartDataWt1: ChartDataPoint[] = [];
  const chartDataWt2: ChartDataPoint[] = [];
  const priceData: PriceData[] = [];
  const sampleValues: {period: number; date: string; close: number; wt1: ReactNode; wt2: ReactNode; signal: string}[] =
    [];

  selectedCandles.forEach((candle, idx) => {
    wt.add({close: Number(candle.close), high: Number(candle.high), low: Number(candle.low)});
    const result = wt.isStable ? wt.getResult() : null;
    const signal = wt.getSignal();
    chartDataWt1.push({x: idx + 1, y: result?.wt1 ?? null});
    chartDataWt2.push({x: idx + 1, y: result?.wt2 ?? null});

    priceData.push(collectPriceData(candle, idx));

    sampleValues.push({
      close: Number(candle.close),
      date: formatDate(candle.openTimeInISO),
      period: idx + 1,
      signal: signal.state,
      wt1: result ? result.wt1.toFixed(2) : <NotAvailable />,
      wt2: result ? result.wt2.toFixed(2) : <NotAvailable />,
    });
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2 select-text">
          WaveTrend({wt.channelInterval}, {wt.averageInterval}, {wt.smoothingInterval}) / Required Inputs:{' '}
          {wt.getRequiredInputs()}
        </h2>
        <p className="text-slate-300 select-text">{config.description}</p>
        <p className="text-slate-400 text-sm mt-2 select-text">
          Measures how far the average price stretches from its smoothed channel. WT1 crossing above WT2 = bullish,
          crossing below = bearish. Readings beyond ±53 mark the overbought/oversold bands, beyond ±60 extreme levels.
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
                data: chartDataWt1.map(point => [point.x, point.y]),
                marker: {fillColor: config.color},
                name: 'WT1',
                type: 'line',
              },
              {
                color: '#f97316',
                data: chartDataWt2.map(point => [point.x, point.y]),
                marker: {fillColor: '#f97316'},
                name: 'WT2',
                type: 'line',
              },
            ],
            title: {style: {color: '#e2e8f0', fontSize: '16px', fontWeight: '600'}, text: 'WaveTrend (10,21,4)'},
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
              plotLines: [
                {color: '#ef4444', dashStyle: 'Dash', value: 60, width: 1},
                {color: '#ef4444', dashStyle: 'Dot', value: 53, width: 1},
                {color: '#22c55e', dashStyle: 'Dot', value: -53, width: 1},
                {color: '#22c55e', dashStyle: 'Dash', value: -60, width: 1},
              ],
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
                <th className="text-left text-slate-300 py-2 px-3">WT1</th>
                <th className="text-left text-slate-300 py-2 px-3">WT2</th>
                <th className="text-left text-slate-300 py-2 px-3">Signal</th>
              </tr>
            </thead>
            <tbody>
              {sampleValues.map(row => (
                <tr key={row.period} className="border-b border-slate-700/50">
                  <td className="text-slate-400 py-2 px-3">{row.period}</td>
                  <td className="text-slate-300 py-2 px-3">{row.date}</td>
                  <td className="text-slate-300 py-2 px-3">${row.close.toFixed(2)}</td>
                  <td className="text-white font-mono py-2 px-3">{row.wt1}</td>
                  <td className="text-white font-mono py-2 px-3">{row.wt2}</td>
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

export const WaveTrend: IndicatorConfig = {
  color: '#14b8a6',
  createIndicator: () => new WaveTrendClass(),
  customRender: renderWaveTrend,
  description: 'WaveTrend Oscillator',
  id: 'wavetrend',
  name: 'WaveTrend',
  requiredInputs: 21,
  type: 'custom',
};
