import {Chart as HighchartsChart} from '@highcharts/react';
import {SuperTrend as SuperTrendClass, TradingSignal} from 'trading-signals';
import type {ReactNode} from 'react';
import type {Candle} from '@typedtrader/exchange';
import type {ChartDataPoint} from '../../components/Chart';
import {NotAvailable} from '../../components/NotAvailable';
import PriceChart, {type PriceData} from '../../components/PriceChart';
import {formatDate} from '../../utils/formatDate';
import {collectPriceData} from '../../utils/renderUtils';
import type {IndicatorConfig} from '../../utils/types';

const renderSuperTrend = (config: IndicatorConfig, selectedCandles: Candle[]) => {
  const st = new SuperTrendClass();
  const chartDataClose: ChartDataPoint[] = [];
  const chartDataUptrend: ChartDataPoint[] = [];
  const chartDataDowntrend: ChartDataPoint[] = [];
  const priceData: PriceData[] = [];
  const sampleValues: {period: number; date: string; close: number; supertrend: ReactNode; trend: ReactNode}[] = [];

  selectedCandles.forEach((candle, idx) => {
    const result = st.add({close: Number(candle.close), high: Number(candle.high), low: Number(candle.low)});
    chartDataClose.push({x: idx + 1, y: Number(candle.close)});
    chartDataUptrend.push({x: idx + 1, y: result?.trend === TradingSignal.BULLISH ? result.supertrend : null});
    chartDataDowntrend.push({x: idx + 1, y: result?.trend === TradingSignal.BEARISH ? result.supertrend : null});

    priceData.push(collectPriceData(candle, idx));

    sampleValues.push({
      close: Number(candle.close),
      date: formatDate(candle.openTimeInISO),
      period: idx + 1,
      supertrend: result ? result.supertrend.toFixed(2) : <NotAvailable />,
      trend: result ? result.trend : <NotAvailable />,
    });
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2 select-text">
          SuperTrend({st.interval}, {st.multiplier}) / Required Inputs: {st.getRequiredInputs()}
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
                name: 'Uptrend (support)',
                type: 'line',
              },
              {
                color: '#ef4444',
                data: chartDataDowntrend.map(point => [point.x, point.y]),
                marker: {fillColor: '#ef4444'},
                name: 'Downtrend (resistance)',
                type: 'line',
              },
            ],
            title: {style: {color: '#e2e8f0', fontSize: '16px', fontWeight: '600'}, text: 'SuperTrend (10, 3)'},
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
                <th className="text-left py-2 px-3 text-slate-400 font-medium">SuperTrend</th>
                <th className="text-left py-2 px-3 text-slate-400 font-medium">Trend</th>
              </tr>
            </thead>
            <tbody>
              {sampleValues.map((row, idx) => (
                <tr key={idx} className="border-b border-slate-700/50">
                  <td className="py-2 px-3 text-white font-mono">{row.period}</td>
                  <td className="py-2 px-3 text-slate-300">{row.date}</td>
                  <td className="py-2 px-3 text-slate-300">${row.close.toFixed(2)}</td>
                  <td className="py-2 px-3 text-white font-mono">{row.supertrend}</td>
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

export const SuperTrend: IndicatorConfig = {
  color: '#10b981',
  createIndicator: () => new SuperTrendClass(),
  customRender: renderSuperTrend,
  description: 'SuperTrend',
  details:
    'Answers the one question a trend follower keeps asking: which side of the market to be on right now. It plots a single ATR-based band that trails below price in an uptrend and above it in a downtrend, and because the band only ratchets in the direction of the trend, it doubles as a volatility-adjusted trailing stop. The line flips sides only when the close breaks through the active band, so a flip marks a potential trend reversal.',
  id: 'supertrend',
  name: 'SuperTrend',
  requiredInputs: 10,
  type: 'custom',
};
