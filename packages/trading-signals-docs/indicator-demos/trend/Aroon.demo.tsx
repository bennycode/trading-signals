import {Chart as HighchartsChart} from '@highcharts/react';
import {Aroon as AroonClass} from 'trading-signals';
import type {ReactNode} from 'react';
import type {Candle} from '@typedtrader/exchange';
import type {ChartDataPoint} from '../../components/Chart';
import {NotAvailable} from '../../components/NotAvailable';
import PriceChart, {type PriceData} from '../../components/PriceChart';
import {formatDate} from '../../utils/formatDate';
import {collectPriceData} from '../../utils/renderUtils';
import type {IndicatorConfig} from '../../utils/types';

const renderAroon = (config: IndicatorConfig, selectedCandles: Candle[]) => {
  const aroon = new AroonClass(14);
  const chartDataUp: ChartDataPoint[] = [];
  const chartDataDown: ChartDataPoint[] = [];
  const priceData: PriceData[] = [];
  const sampleValues: {period: number; date: string; close: number; up: ReactNode; down: ReactNode}[] = [];

  selectedCandles.forEach((candle, idx) => {
    const result = aroon.add({high: Number(candle.high), low: Number(candle.low)});
    chartDataUp.push({x: idx + 1, y: result?.aroonUp ?? null});
    chartDataDown.push({x: idx + 1, y: result?.aroonDown ?? null});

    priceData.push(collectPriceData(candle, idx));

    sampleValues.push({
      close: Number(candle.close),
      date: formatDate(candle.openTimeInISO),
      down: result ? result.aroonDown.toFixed(2) : <NotAvailable />,
      period: idx + 1,
      up: result ? result.aroonUp.toFixed(2) : <NotAvailable />,
    });
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2 select-text">
          Aroon({aroon.interval}) / Required Inputs: {aroon.getRequiredInputs()}
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
                data: chartDataUp.map(point => [point.x, point.y]),
                marker: {fillColor: '#10b981'},
                name: 'Aroon Up',
                type: 'line',
              },
              {
                color: '#ef4444',
                data: chartDataDown.map(point => [point.x, point.y]),
                marker: {fillColor: '#ef4444'},
                name: 'Aroon Down',
                type: 'line',
              },
            ],
            title: {style: {color: '#e2e8f0', fontSize: '16px', fontWeight: '600'}, text: 'Aroon (14)'},
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
              max: 100,
              min: 0,
              title: {style: {color: '#94a3b8'}, text: 'Aroon'},
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
                <th className="text-left py-2 px-3 text-slate-400 font-medium">Aroon Up</th>
                <th className="text-left py-2 px-3 text-slate-400 font-medium">Aroon Down</th>
              </tr>
            </thead>
            <tbody>
              {sampleValues.map((row, idx) => (
                <tr key={idx} className="border-b border-slate-700/50">
                  <td className="py-2 px-3 text-white font-mono">{row.period}</td>
                  <td className="py-2 px-3 text-slate-300">{row.date}</td>
                  <td className="py-2 px-3 text-slate-300">${row.close.toFixed(2)}</td>
                  <td className="py-2 px-3 text-white font-mono">{row.up}</td>
                  <td className="py-2 px-3 text-white font-mono">{row.down}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export const Aroon: IndicatorConfig = {
  color: '#10b981',
  createIndicator: () => new AroonClass(14),
  customRender: renderAroon,
  description: 'Aroon',
  details:
    'Identifies emerging trends by measuring how recently the highest high and lowest low occurred within the interval. An Aroon Up above 70 with an Aroon Down below 30 indicates a strong uptrend; crossovers of the two lines can signal trend changes.',
  id: 'aroon',
  name: 'Aroon',
  requiredInputs: 15,
  type: 'custom',
};
