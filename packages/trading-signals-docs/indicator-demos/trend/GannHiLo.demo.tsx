import {Chart as HighchartsChart} from '@highcharts/react';
import {GannHiLo as GannHiLoClass, TradingSignal} from 'trading-signals';
import type {ReactNode} from 'react';
import type {Candle} from '@typedtrader/exchange';
import {createSharedTooltipFormatter, type ChartDataPoint} from '../../components/Chart';
import {NotAvailable} from '../../components/NotAvailable';
import PriceChart, {type PriceData} from '../../components/PriceChart';
import {formatDate} from '../../utils/formatDate';
import {collectPriceData} from '../../utils/renderUtils';
import type {IndicatorConfig} from '../../utils/types';

const renderGannHiLo = (config: IndicatorConfig, selectedCandles: Candle[]) => {
  const hilo = new GannHiLoClass();
  const chartDataClose: ChartDataPoint[] = [];
  const chartDataUptrend: ChartDataPoint[] = [];
  const chartDataDowntrend: ChartDataPoint[] = [];
  const priceData: PriceData[] = [];
  const sampleValues: {period: number; date: string; close: number; line: ReactNode; trend: ReactNode}[] = [];

  selectedCandles.forEach((candle, idx) => {
    const result = hilo.add({close: Number(candle.close), high: Number(candle.high), low: Number(candle.low)});
    chartDataClose.push({x: idx + 1, y: Number(candle.close)});
    chartDataUptrend.push({x: idx + 1, y: result?.trend === TradingSignal.BULLISH ? result.line : null});
    chartDataDowntrend.push({x: idx + 1, y: result?.trend === TradingSignal.BEARISH ? result.line : null});

    priceData.push(collectPriceData(candle, idx));

    sampleValues.push({
      close: Number(candle.close),
      date: formatDate(candle.openTimeInISO),
      line: result ? result.line.toFixed(2) : <NotAvailable />,
      period: idx + 1,
      trend: result ? result.trend : <NotAvailable />,
    });
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2 select-text">
          GannHiLo({hilo.highInterval}, {hilo.lowInterval}) / Required Inputs: {hilo.getRequiredInputs()}
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
                color: '#94a3b8',
                data: chartDataClose.map(point => [point.x, point.y]),
                marker: {fillColor: '#94a3b8'},
                name: 'Close',
                type: 'line',
              },
              {
                color: '#10b981',
                data: chartDataUptrend.map(point => [point.x, point.y]),
                marker: {fillColor: '#10b981'},
                name: 'Uptrend (average of lows)',
                type: 'line',
              },
              {
                color: '#ef4444',
                data: chartDataDowntrend.map(point => [point.x, point.y]),
                marker: {fillColor: '#ef4444'},
                name: 'Downtrend (average of highs)',
                type: 'line',
              },
            ],
            title: {
              style: {color: '#e2e8f0', fontSize: '16px', fontWeight: '600'},
              text: 'Gann HiLo Activator (13, 21)',
            },
            tooltip: {
              backgroundColor: '#1e293b',
              borderColor: '#475569',
              formatter: createSharedTooltipFormatter(),
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
              title: {style: {color: '#94a3b8'}, text: 'Price'},
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
                <th className="text-left py-2 px-3 text-slate-400 font-medium">HiLo</th>
                <th className="text-left py-2 px-3 text-slate-400 font-medium">Trend</th>
              </tr>
            </thead>
            <tbody>
              {sampleValues.map((row, idx) => (
                <tr key={idx} className="border-b border-slate-700/50">
                  <td className="py-2 px-3 text-white font-mono">{row.period}</td>
                  <td className="py-2 px-3 text-slate-300">{row.date}</td>
                  <td className="py-2 px-3 text-slate-300">${row.close.toFixed(2)}</td>
                  <td className="py-2 px-3 text-white font-mono">{row.line}</td>
                  <td className="py-2 px-3 text-white font-mono">{row.trend}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export const GannHiLo: IndicatorConfig = {
  color: '#10b981',
  createIndicator: () => new GannHiLoClass(),
  customRender: renderGannHiLo,
  description: 'Gann HiLo Activator',
  details:
    'Robert Krausz built his Gann swing trading plans around this activator: it tracks a simple moving average of the highs and one of the lows, and the close picks which of the two is plotted. Closing above the previous average of the highs activates the average of the lows as rising support, closing below the previous average of the lows activates the average of the highs as falling resistance, and between the two averages the line freezes, so a pullback never loosens the stop.',
  id: 'gann-hilo',
  name: 'Gann HiLo Activator',
  requiredInputs: 21,
  type: 'custom',
};
