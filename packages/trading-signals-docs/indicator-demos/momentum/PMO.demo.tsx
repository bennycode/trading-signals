import {Chart as HighchartsChart} from '@highcharts/react';
import {PMO as PMOClass} from 'trading-signals';
import type {ReactNode} from 'react';
import type {Candle} from '@typedtrader/exchange';
import {createSharedTooltipFormatter, type ChartDataPoint} from '../../components/Chart';
import {NotAvailable} from '../../components/NotAvailable';
import PriceChart, {type PriceData} from '../../components/PriceChart';
import {SignalBadge} from '../../components/SignalBadge';
import {formatDate} from '../../utils/formatDate';
import {collectPriceData} from '../../utils/renderUtils';
import type {IndicatorConfig} from '../../utils/types';

const renderPMO = (config: IndicatorConfig, selectedCandles: Candle[]) => {
  const pmo = new PMOClass();
  const chartDataPMO: ChartDataPoint[] = [];
  const chartDataSignal: ChartDataPoint[] = [];
  const priceData: PriceData[] = [];
  const sampleValues: {period: number; date: string; close: number; result: ReactNode; signal: string}[] = [];

  selectedCandles.forEach((candle, idx) => {
    pmo.add(Number(candle.close));
    const result = pmo.isStable ? pmo.getResult() : null;
    const trendSignal = pmo.getSignal();
    chartDataPMO.push({x: idx + 1, y: result?.pmo ?? null});
    chartDataSignal.push({x: idx + 1, y: result?.signal ?? null});

    priceData.push(collectPriceData(candle, idx));

    sampleValues.push({
      close: Number(candle.close),
      date: formatDate(candle.openTimeInISO),
      period: idx + 1,
      result: result ? `${result.pmo.toFixed(4)}` : <NotAvailable />,
      signal: trendSignal.state,
    });
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2 select-text">
          PMO(35, 20, 10) / Required Inputs: {pmo.getRequiredInputs()}
        </h2>
        <p className="text-slate-300 select-text">{config.description}</p>
        <p className="text-slate-400 text-sm mt-2 select-text">
          Double-smooths the one-bar percentage price change, scaled by 10. Crossing above the signal line = bullish,
          crossing below = bearish.
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
                data: chartDataPMO.map(point => [point.x, point.y]),
                marker: {fillColor: config.color},
                name: 'PMO',
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
            title: {style: {color: '#e2e8f0', fontSize: '16px', fontWeight: '600'}, text: 'PMO (35,20,10)'},
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
                <th className="text-left text-slate-300 py-2 px-3">PMO</th>
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

export const PMO: IndicatorConfig = {
  color: '#0ea5e9',
  createIndicator: () => new PMOClass(),
  customRender: renderPMO,
  description: 'DecisionPoint Price Momentum Oscillator',
  id: 'pmo',
  name: 'PMO',
  requiredInputs: 55,
  type: 'custom',
};
