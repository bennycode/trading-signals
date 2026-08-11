import {Chart as HighchartsChart} from '@highcharts/react';
import {ElderRay as ElderRayClass} from 'trading-signals';
import type {ReactNode} from 'react';
import type {Candle} from '@typedtrader/exchange';
import {createSharedTooltipFormatter, type ChartDataPoint} from '../../components/Chart';
import {NotAvailable} from '../../components/NotAvailable';
import PriceChart, {type PriceData} from '../../components/PriceChart';
import {SignalBadge} from '../../components/SignalBadge';
import {formatDate} from '../../utils/formatDate';
import {collectPriceData} from '../../utils/renderUtils';
import type {IndicatorConfig} from '../../utils/types';

const renderElderRay = (config: IndicatorConfig, selectedCandles: Candle[]) => {
  const eri = new ElderRayClass(13);
  const chartDataBull: ChartDataPoint[] = [];
  const chartDataBear: ChartDataPoint[] = [];
  const priceData: PriceData[] = [];
  const sampleValues: {
    period: number;
    date: string;
    close: number;
    bull: ReactNode;
    bear: ReactNode;
    signal: string;
  }[] = [];

  selectedCandles.forEach((candle, idx) => {
    eri.add({close: Number(candle.close), high: Number(candle.high), low: Number(candle.low)});
    const result = eri.isStable ? eri.getResult() : null;
    const signal = eri.getSignal();
    chartDataBull.push({x: idx + 1, y: result?.bullPower ?? null});
    chartDataBear.push({x: idx + 1, y: result?.bearPower ?? null});

    priceData.push(collectPriceData(candle, idx));

    sampleValues.push({
      bear: result ? result.bearPower.toFixed(4) : <NotAvailable />,
      bull: result ? result.bullPower.toFixed(4) : <NotAvailable />,
      close: Number(candle.close),
      date: formatDate(candle.openTimeInISO),
      period: idx + 1,
      signal: signal.state,
    });
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2 select-text">
          ElderRay(13) / Required Inputs: {eri.getRequiredInputs()}
        </h2>
        <p className="text-slate-300 select-text">{config.description}</p>
        <p className="text-slate-400 text-sm mt-2 select-text">
          Measures how far bulls push the high and bears drag the low away from a 13-period EMA of closing prices. Both
          powers positive = buyers dominate, both negative = sellers dominate.
        </p>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
        <HighchartsChart
          options={{
            chart: {backgroundColor: 'transparent', height: 300, type: 'column'},
            credits: {enabled: false},
            legend: {enabled: true, itemStyle: {color: '#e2e8f0'}},
            plotOptions: {
              column: {borderWidth: 0},
            },
            series: [
              {
                color: config.color,
                data: chartDataBull.map(point => [point.x, point.y]),
                name: 'Bull Power',
                type: 'column',
              },
              {
                color: '#ef4444',
                data: chartDataBear.map(point => [point.x, point.y]),
                name: 'Bear Power',
                type: 'column',
              },
            ],
            title: {style: {color: '#e2e8f0', fontSize: '16px', fontWeight: '600'}, text: 'Elder Ray Index (13)'},
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
              title: {style: {color: '#94a3b8'}, text: 'Power'},
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
                <th className="text-left text-slate-300 py-2 px-3">Bull Power</th>
                <th className="text-left text-slate-300 py-2 px-3">Bear Power</th>
                <th className="text-left text-slate-300 py-2 px-3">Signal</th>
              </tr>
            </thead>
            <tbody>
              {sampleValues.map(row => (
                <tr key={row.period} className="border-b border-slate-700/50">
                  <td className="text-slate-400 py-2 px-3">{row.period}</td>
                  <td className="text-slate-400 py-2 px-3">{row.date}</td>
                  <td className="text-slate-300 py-2 px-3">${row.close.toFixed(2)}</td>
                  <td className="text-white font-mono py-2 px-3">{row.bull}</td>
                  <td className="text-white font-mono py-2 px-3">{row.bear}</td>
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

export const ElderRay: IndicatorConfig = {
  color: '#22c55e',
  createIndicator: () => new ElderRayClass(13),
  customRender: renderElderRay,
  description: 'Elder Ray Index',
  id: 'elder-ray',
  name: 'Elder Ray',
  requiredInputs: 13,
  type: 'custom',
};
