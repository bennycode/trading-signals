import {Chart as HighchartsChart} from '@highcharts/react';
import {RandomWalkIndex as RandomWalkIndexClass} from 'trading-signals';
import type {ReactNode} from 'react';
import type {Candle} from '@typedtrader/exchange';
import {createSharedTooltipFormatter, type ChartDataPoint} from '../../components/Chart';
import {NotAvailable} from '../../components/NotAvailable';
import PriceChart, {type PriceData} from '../../components/PriceChart';
import {SignalBadge} from '../../components/SignalBadge';
import {formatDate} from '../../utils/formatDate';
import {collectPriceData} from '../../utils/renderUtils';
import type {IndicatorConfig} from '../../utils/types';

const renderRandomWalkIndex = (config: IndicatorConfig, selectedCandles: Candle[]) => {
  const rwi = new RandomWalkIndexClass(14);
  const chartDataHigh: ChartDataPoint[] = [];
  const chartDataLow: ChartDataPoint[] = [];
  const priceData: PriceData[] = [];
  const sampleValues: {
    period: number;
    date: string;
    close: number;
    high: ReactNode;
    low: ReactNode;
    signal: string;
  }[] = [];

  selectedCandles.forEach((candle, idx) => {
    const result = rwi.add({close: Number(candle.close), high: Number(candle.high), low: Number(candle.low)});
    const trendSignal = rwi.getSignal();
    chartDataHigh.push({x: idx + 1, y: result?.high ?? null});
    chartDataLow.push({x: idx + 1, y: result?.low ?? null});

    priceData.push(collectPriceData(candle, idx));

    sampleValues.push({
      close: Number(candle.close),
      date: formatDate(candle.openTimeInISO),
      high: result ? result.high.toFixed(4) : <NotAvailable />,
      low: result ? result.low.toFixed(4) : <NotAvailable />,
      period: idx + 1,
      signal: trendSignal.state,
    });
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2 select-text">
          Random Walk Index({rwi.interval}) / Required Inputs: {rwi.getRequiredInputs()}
        </h2>
        <p className="text-slate-300 select-text">{config.description}</p>
        {config.details && <p className="text-slate-400 text-sm mt-2 select-text">{config.details}</p>}
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
                color: '#10b981',
                data: chartDataHigh.map(point => [point.x, point.y]),
                marker: {fillColor: '#10b981'},
                name: 'RWI High',
                type: 'line',
              },
              {
                color: '#ef4444',
                data: chartDataLow.map(point => [point.x, point.y]),
                marker: {fillColor: '#ef4444'},
                name: 'RWI Low',
                type: 'line',
              },
            ],
            title: {style: {color: '#e2e8f0', fontSize: '16px', fontWeight: '600'}, text: 'Random Walk Index (14)'},
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
              plotLines: [{color: '#94a3b8', dashStyle: 'Dash', value: 1, width: 1}],
              title: {style: {color: '#94a3b8'}, text: 'Random Walk Index'},
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
                <th className="text-left text-slate-300 py-2 px-3">RWI High</th>
                <th className="text-left text-slate-300 py-2 px-3">RWI Low</th>
                <th className="text-left text-slate-300 py-2 px-3">Signal</th>
              </tr>
            </thead>
            <tbody>
              {sampleValues.map(row => (
                <tr key={row.period} className="border-b border-slate-700/50">
                  <td className="text-slate-400 py-2 px-3">{row.period}</td>
                  <td className="text-slate-300 py-2 px-3">{row.date}</td>
                  <td className="text-slate-300 py-2 px-3">${row.close.toFixed(2)}</td>
                  <td className="text-white font-mono py-2 px-3">{row.high}</td>
                  <td className="text-white font-mono py-2 px-3">{row.low}</td>
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

export const RandomWalkIndex: IndicatorConfig = {
  color: '#10b981',
  createIndicator: () => new RandomWalkIndexClass(14),
  customRender: renderRandomWalkIndex,
  description: 'Random Walk Index',
  details:
    'Compares how far price actually travelled against how far a random walk would drift. Readings above 1 mark non-random, trending movement; the greater line names the side in control.',
  id: 'rwi',
  name: 'Random Walk Index',
  requiredInputs: 15,
  type: 'custom',
};
