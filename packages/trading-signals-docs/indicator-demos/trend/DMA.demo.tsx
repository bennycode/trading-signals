import {Chart as HighchartsChart} from '@highcharts/react';
import {DMA as DMAClass, SMA} from 'trading-signals';
import type {ReactNode} from 'react';
import type {ExchangeCandle} from '@typedtrader/exchange';
import type {ChartDataPoint} from '../../components/Chart';
import {NotAvailable} from '../../components/NotAvailable';
import PriceChart, {type PriceData} from '../../components/PriceChart';
import {SignalBadge} from '../../components/SignalBadge';
import {formatDate} from '../../utils/formatDate';
import {collectPriceData} from '../../utils/renderUtils';
import type {IndicatorConfig} from '../../utils/types';

const renderDMA = (config: IndicatorConfig, selectedCandles: ExchangeCandle[]) => {
  const dma = new DMAClass(5, 9, SMA);
  const chartDataShort: ChartDataPoint[] = [];
  const chartDataLong: ChartDataPoint[] = [];
  const priceData: PriceData[] = [];
  const sampleValues: Array<{
    period: number;
    date: string;
    close: number;
    short: ReactNode;
    long: ReactNode;
    signal: string;
  }> = [];

  selectedCandles.forEach((candle, idx) => {
    dma.add(Number(candle.close));
    const result = dma.isStable ? dma.getResult() : null;
    const signal =
      'getSignal' in dma
        ? (dma.getSignal as () => {state: string; hasChanged: boolean})()
        : {state: 'UNKNOWN', hasChanged: false};
    chartDataShort.push({x: idx + 1, y: result?.short ?? null});
    chartDataLong.push({x: idx + 1, y: result?.long ?? null});

    priceData.push(collectPriceData(candle, idx));

    sampleValues.push({
      period: idx + 1,
      date: formatDate(candle.openTimeInISO),
      close: Number(candle.close),
      short: result ? result.short.toFixed(2) : <NotAvailable />,
      long: result ? result.long.toFixed(2) : <NotAvailable />,
      signal: signal.state,
    });
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2 select-text">
          DMA(5, 9) / Required Inputs: {dma.getRequiredInputs()}
        </h2>
        <p className="text-slate-300 select-text">{config.description}</p>
        {config.details && <p className="text-slate-400 text-sm mt-2 select-text">{config.details}</p>}
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
        <HighchartsChart
          options={{
            chart: {type: 'line', backgroundColor: 'transparent', height: 300},
            title: {text: 'Dual Moving Average (5,9)', style: {color: '#e2e8f0', fontSize: '16px', fontWeight: '600'}},
            credits: {enabled: false},
            xAxis: {
              title: {text: 'Period', style: {color: '#94a3b8'}},
              labels: {style: {color: '#94a3b8'}},
              gridLineColor: '#334155',
            },
            yAxis: {
              title: {text: 'Price', style: {color: '#94a3b8'}},
              labels: {style: {color: '#94a3b8'}},
              gridLineColor: '#334155',
            },
            legend: {enabled: true, itemStyle: {color: '#e2e8f0'}},
            plotOptions: {line: {marker: {enabled: true, radius: 3}, lineWidth: 2}},
            series: [
              {
                type: 'line',
                name: 'Short MA (5)',
                data: chartDataShort.map(point => [point.x, point.y]),
                color: config.color,
                marker: {fillColor: config.color},
              },
              {
                type: 'line',
                name: 'Long MA (9)',
                data: chartDataLong.map(point => [point.x, point.y]),
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
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-600">
                <th className="text-left py-2 px-3 text-slate-400 font-medium">Period</th>
                <th className="text-left py-2 px-3 text-slate-400 font-medium">Date</th>
                <th className="text-left py-2 px-3 text-slate-400 font-medium">Close</th>
                <th className="text-left py-2 px-3 text-slate-400 font-medium">Short MA</th>
                <th className="text-left py-2 px-3 text-slate-400 font-medium">Long MA</th>
                <th className="text-left py-2 px-3 text-slate-400 font-medium">Signal</th>
              </tr>
            </thead>
            <tbody>
              {sampleValues.map((row, idx) => (
                <tr key={idx} className="border-b border-slate-700/50">
                  <td className="py-2 px-3 text-white font-mono">{row.period}</td>
                  <td className="py-2 px-3 text-slate-300">{row.date}</td>
                  <td className="py-2 px-3 text-slate-300">${row.close.toFixed(2)}</td>
                  <td className="py-2 px-3 text-white font-mono">{row.short}</td>
                  <td className="py-2 px-3 text-white font-mono">{row.long}</td>
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

export const DMA: IndicatorConfig = {
  id: 'dma',
  name: 'DMA',
  description: 'Dual Moving Average',
  color: '#22d3ee',
  type: 'custom',
  requiredInputs: 9,
  details:
    'Compares two moving averages. When the short MA crosses above the long MA, it signals a potential buy opportunity.',
  createIndicator: () => new DMAClass(5, 9, SMA),
  customRender: renderDMA,
};
