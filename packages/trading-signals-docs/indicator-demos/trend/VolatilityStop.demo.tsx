import {Chart as HighchartsChart} from '@highcharts/react';
import {TradingSignal, VolatilityStop as VolatilityStopClass} from 'trading-signals';
import type {ReactNode} from 'react';
import type {Candle} from '@typedtrader/exchange';
import {createSharedTooltipFormatter, type ChartDataPoint} from '../../components/Chart';
import {NotAvailable} from '../../components/NotAvailable';
import PriceChart, {type PriceData} from '../../components/PriceChart';
import {formatDate} from '../../utils/formatDate';
import {collectPriceData} from '../../utils/renderUtils';
import type {IndicatorConfig} from '../../utils/types';

const renderVolatilityStop = (config: IndicatorConfig, selectedCandles: Candle[]) => {
  const vstop = new VolatilityStopClass();
  const chartDataClose: ChartDataPoint[] = [];
  const chartDataSupport: ChartDataPoint[] = [];
  const chartDataResistance: ChartDataPoint[] = [];
  const priceData: PriceData[] = [];
  const sampleValues: {period: number; date: string; close: number; stop: ReactNode; side: ReactNode}[] = [];

  selectedCandles.forEach((candle, idx) => {
    const result = vstop.add({close: Number(candle.close), high: Number(candle.high), low: Number(candle.low)});
    chartDataClose.push({x: idx + 1, y: Number(candle.close)});
    chartDataSupport.push({x: idx + 1, y: result?.signal === TradingSignal.BULLISH ? result.stop : null});
    chartDataResistance.push({x: idx + 1, y: result?.signal === TradingSignal.BEARISH ? result.stop : null});

    priceData.push(collectPriceData(candle, idx));

    sampleValues.push({
      close: Number(candle.close),
      date: formatDate(candle.openTimeInISO),
      period: idx + 1,
      side: result ? result.signal : <NotAvailable />,
      stop: result ? result.stop.toFixed(2) : <NotAvailable />,
    });
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2 select-text">
          VolatilityStop({vstop.interval}, {vstop.multiplier}) / Required Inputs: {vstop.getRequiredInputs()}
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
                data: chartDataSupport.map(point => [point.x, point.y]),
                marker: {fillColor: '#10b981'},
                name: 'Stop (support)',
                type: 'line',
              },
              {
                color: '#ef4444',
                data: chartDataResistance.map(point => [point.x, point.y]),
                marker: {fillColor: '#ef4444'},
                name: 'Stop (resistance)',
                type: 'line',
              },
            ],
            title: {style: {color: '#e2e8f0', fontSize: '16px', fontWeight: '600'}, text: 'Volatility Stop (5, 3.5)'},
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
                <th className="text-left py-2 px-3 text-slate-400 font-medium">Stop</th>
                <th className="text-left py-2 px-3 text-slate-400 font-medium">Side</th>
              </tr>
            </thead>
            <tbody>
              {sampleValues.map((row, idx) => (
                <tr key={idx} className="border-b border-slate-700/50">
                  <td className="py-2 px-3 text-white font-mono">{row.period}</td>
                  <td className="py-2 px-3 text-slate-300">{row.date}</td>
                  <td className="py-2 px-3 text-slate-300">${row.close.toFixed(2)}</td>
                  <td className="py-2 px-3 text-white font-mono">{row.stop}</td>
                  <td className="py-2 px-3 text-white font-mono">{row.side}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export const VolatilityStop: IndicatorConfig = {
  color: '#10b981',
  createIndicator: () => new VolatilityStopClass(),
  customRender: renderVolatilityStop,
  description: 'Volatility Stop',
  details:
    "Trails a stop a multiple of the Average True Range behind the closing price, so the stop only ratchets in the trade's favor: it rises (never falls) below price in an uptrend and falls (never rises) above price in a downtrend. A close beyond the stop flips it to the other side of the price — the stop switches from acting as support to acting as resistance (or back), signaling a trend change rather than mere noise.",
  id: 'volatility-stop',
  name: 'Volatility Stop',
  requiredInputs: 5,
  type: 'custom',
};
