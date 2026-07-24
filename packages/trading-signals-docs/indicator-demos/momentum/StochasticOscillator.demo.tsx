import {Chart as HighchartsChart} from '@highcharts/react';
import {StochasticOscillator as StochasticOscillatorClass} from 'trading-signals';
import type {ReactNode} from 'react';
import type {Candle} from '@typedtrader/exchange';
import type {ChartDataPoint} from '../../components/Chart';
import {NotAvailable} from '../../components/NotAvailable';
import PriceChart, {type PriceData} from '../../components/PriceChart';
import {SignalBadge} from '../../components/SignalBadge';
import {formatDate} from '../../utils/formatDate';
import {collectPriceData} from '../../utils/renderUtils';
import type {IndicatorConfig} from '../../utils/types';

const renderStochastic = (config: IndicatorConfig, selectedCandles: Candle[]) => {
  const stoch = new StochasticOscillatorClass({dPeriod: 3, kPeriod: 14, kSlowingPeriod: 3});
  const chartDataK: ChartDataPoint[] = [];
  const chartDataD: ChartDataPoint[] = [];
  const priceData: PriceData[] = [];
  const sampleValues: {period: number; date: string; close: number; k: ReactNode; d: ReactNode; signal: string}[] = [];

  selectedCandles.forEach((candle, idx) => {
    stoch.add({close: Number(candle.close), high: Number(candle.high), low: Number(candle.low)});
    const result = stoch.isStable ? stoch.getResult() : null;
    const signal = stoch.getSignal();
    chartDataK.push({x: idx + 1, y: result?.stochK ?? null});
    chartDataD.push({x: idx + 1, y: result?.stochD ?? null});

    priceData.push(collectPriceData(candle, idx));

    sampleValues.push({
      close: Number(candle.close),
      d: result ? result.stochD.toFixed(2) : <NotAvailable />,
      date: formatDate(candle.openTimeInISO),
      k: result ? result.stochK.toFixed(2) : <NotAvailable />,
      period: idx + 1,
      signal: signal.state,
    });
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2 select-text">
          StochasticOscillator({stoch.kPeriod}, {stoch.kSlowingPeriod}, {stoch.dPeriod}) / Required Inputs:{' '}
          {stoch.getRequiredInputs()}
        </h2>
        <p className="text-slate-300 select-text">{config.description}</p>
        <p className="text-slate-400 text-sm mt-2 select-text">
          Compares closing price to price range over a period. %K crossing above %D can signal a buying opportunity.
        </p>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
        <HighchartsChart
          options={{
            chart: {backgroundColor: 'transparent', height: 300, type: 'line'},
            credits: {enabled: false},
            legend: {enabled: true, itemStyle: {color: '#e2e8f0'}},
            plotOptions: {line: {lineWidth: 2, marker: {enabled: true, radius: 3}}},
            series: [
              {
                color: config.color,
                data: chartDataK.map(point => [point.x, point.y]),
                marker: {fillColor: config.color},
                name: '%K',
                type: 'line',
              },
              {
                color: '#f97316',
                data: chartDataD.map(point => [point.x, point.y]),
                marker: {fillColor: '#f97316'},
                name: '%D',
                type: 'line',
              },
            ],
            title: {
              style: {color: '#e2e8f0', fontSize: '16px', fontWeight: '600'},
              text: 'Stochastic Oscillator (14,3,3)',
            },
            tooltip: {
              backgroundColor: '#1e293b',
              borderColor: '#475569',
              formatter: function () {
                let s: string = `<b>Period ${(this as any).x}</b><br/>`;
                ((this as any).points as any[])?.forEach((point: any) => {
                  const yValue = typeof point.y === 'number' ? point.y.toFixed(2) : 'N/A';
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
                <th className="text-left text-slate-300 py-2 px-3">%K</th>
                <th className="text-left text-slate-300 py-2 px-3">%D</th>
                <th className="text-left text-slate-300 py-2 px-3">Signal</th>
              </tr>
            </thead>
            <tbody>
              {sampleValues.map(row => (
                <tr key={row.period} className="border-b border-slate-700/50">
                  <td className="text-slate-400 py-2 px-3">{row.period}</td>
                  <td className="text-slate-400 py-2 px-3">{row.date}</td>
                  <td className="text-slate-300 py-2 px-3">${row.close.toFixed(2)}</td>
                  <td className="text-white font-mono py-2 px-3">{row.k}</td>
                  <td className="text-white font-mono py-2 px-3">{row.d}</td>
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

export const StochasticOscillator: IndicatorConfig = {
  color: '#ec4899',
  createIndicator: () => new StochasticOscillatorClass({dPeriod: 3, kPeriod: 14, kSlowingPeriod: 3}),
  customRender: renderStochastic,
  description: 'Stochastic Oscillator',
  id: 'stoch',
  name: 'Stochastic',
  requiredInputs: 17,
  type: 'custom',
};
