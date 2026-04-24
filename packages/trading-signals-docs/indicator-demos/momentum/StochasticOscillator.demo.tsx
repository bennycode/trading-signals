import {Chart as HighchartsChart} from '@highcharts/react';
import {StochasticOscillator as StochasticOscillatorClass} from 'trading-signals';
import type {ReactNode} from 'react';
import type {ExchangeCandle} from '@typedtrader/exchange';
import type {ChartDataPoint} from '../../components/Chart';
import {NotAvailable} from '../../components/NotAvailable';
import PriceChart, {type PriceData} from '../../components/PriceChart';
import {SignalBadge} from '../../components/SignalBadge';
import {formatDate} from '../../utils/formatDate';
import {collectPriceData} from '../../utils/renderUtils';
import type {IndicatorConfig} from '../../utils/types';

const renderStochastic = (config: IndicatorConfig, selectedCandles: ExchangeCandle[]) => {
  const stoch = new StochasticOscillatorClass(14, 3, 3);
  const chartDataK: ChartDataPoint[] = [];
  const chartDataD: ChartDataPoint[] = [];
  const priceData: PriceData[] = [];
  const sampleValues: Array<{period: number; date: string; close: number; k: ReactNode; d: ReactNode; signal: string}> = [];

  selectedCandles.forEach((candle, idx) => {
    stoch.add({high: Number(candle.high), low: Number(candle.low), close: Number(candle.close)});
    const result = stoch.isStable ? stoch.getResult() : null;
    const signal = stoch.getSignal();
    chartDataK.push({x: idx + 1, y: result?.stochK ?? null});
    chartDataD.push({x: idx + 1, y: result?.stochD ?? null});

    priceData.push(collectPriceData(candle, idx));

    sampleValues.push({
      period: idx + 1,
      date: formatDate(candle.openTimeInISO),
      close: Number(candle.close),
      k: result ? result.stochK.toFixed(2) : <NotAvailable />,
      d: result ? result.stochD.toFixed(2) : <NotAvailable />,
      signal: signal.state,
    });
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2 select-text">
          StochasticOscillator({stoch.n}, {stoch.m}, {stoch.p}) / Required Inputs: {stoch.getRequiredInputs()}
        </h2>
        <p className="text-slate-300 select-text">{config.description}</p>
        <p className="text-slate-400 text-sm mt-2 select-text">
          Compares closing price to price range over a period. %K crossing above %D can signal a buying opportunity.
        </p>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
        <HighchartsChart
          options={{
            chart: {type: 'line', backgroundColor: 'transparent', height: 300},
            title: {text: 'Stochastic Oscillator (14,3,3)', style: {color: '#e2e8f0', fontSize: '16px', fontWeight: '600'}},
            credits: {enabled: false},
            xAxis: {
              title: {text: 'Period', style: {color: '#94a3b8'}},
              labels: {style: {color: '#94a3b8'}},
              gridLineColor: '#334155',
            },
            yAxis: {
              title: {text: 'Value', style: {color: '#94a3b8'}},
              labels: {style: {color: '#94a3b8'}},
              gridLineColor: '#334155',
            },
            legend: {enabled: true, itemStyle: {color: '#e2e8f0'}},
            plotOptions: {line: {marker: {enabled: true, radius: 3}, lineWidth: 2}},
            series: [
              {
                type: 'line',
                name: '%K',
                data: chartDataK.map(point => [point.x, point.y]),
                color: config.color,
                marker: {fillColor: config.color},
              },
              {
                type: 'line',
                name: '%D',
                data: chartDataD.map(point => [point.x, point.y]),
                color: '#f97316',
                marker: {fillColor: '#f97316'},
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
  id: 'stoch',
  name: 'Stochastic',
  description: 'Stochastic Oscillator',
  color: '#ec4899',
  type: 'custom',
  requiredInputs: 17,
  createIndicator: () => new StochasticOscillatorClass(14, 3, 3),
  customRender: renderStochastic,
};
