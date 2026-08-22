import {CollapsibleCard} from '../../components/CollapsibleCard';
import {Chart as HighchartsChart} from '@highcharts/react';
import {DMA as DMAClass, SMA} from 'trading-signals';
import type {ReactNode} from 'react';
import type {Candle} from '@typedtrader/exchange';
import {createSharedTooltipFormatter, type ChartDataPoint} from '../../components/Chart';
import {NotAvailable} from '../../components/NotAvailable';
import PriceChart, {type PriceData} from '../../components/PriceChart';
import {SignalBadge} from '../../components/SignalBadge';
import {formatDate} from '../../utils/formatDate';
import {collectPriceData} from '../../utils/renderUtils';
import type {IndicatorConfig} from '../../utils/types';

const renderDMA = (config: IndicatorConfig, selectedCandles: Candle[]) => {
  const dma = new DMAClass(5, 9, SMA);
  const chartDataShort: ChartDataPoint[] = [];
  const chartDataLong: ChartDataPoint[] = [];
  const priceData: PriceData[] = [];
  const sampleValues: {
    period: number;
    date: string;
    close: number;
    short: ReactNode;
    long: ReactNode;
    signal: string;
  }[] = [];

  selectedCandles.forEach((candle, idx) => {
    dma.add(Number(candle.close));
    const result = dma.isStable ? dma.getResult() : null;
    const signal =
      'getSignal' in dma
        ? (dma.getSignal as () => {state: string; hasChanged: boolean})()
        : {hasChanged: false, state: 'UNKNOWN'};
    chartDataShort.push({x: idx + 1, y: result?.short ?? null});
    chartDataLong.push({x: idx + 1, y: result?.long ?? null});

    priceData.push(collectPriceData(candle, idx));

    sampleValues.push({
      close: Number(candle.close),
      date: formatDate(candle.openTimeInISO),
      long: result ? result.long.toFixed(2) : <NotAvailable />,
      period: idx + 1,
      short: result ? result.short.toFixed(2) : <NotAvailable />,
      signal: signal.state,
    });
  });

  return (
    <div className="space-y-6">
      <div className="demo-card">
        <HighchartsChart
          options={{
            chart: {backgroundColor: 'transparent', height: 300, type: 'line'},
            credits: {enabled: false},
            legend: {enabled: true, itemStyle: {color: '#e2e8f0'}},
            plotOptions: {line: {lineWidth: 2, marker: {enabled: true, radius: 3}}},
            series: [
              {
                color: config.color,
                data: chartDataShort.map(point => [point.x, point.y]),
                marker: {fillColor: config.color},
                name: 'Short MA (5)',
                type: 'line',
              },
              {
                color: '#f97316',
                data: chartDataLong.map(point => [point.x, point.y]),
                marker: {fillColor: '#f97316'},
                name: 'Long MA (9)',
                type: 'line',
              },
            ],
            title: {style: {color: '#e2e8f0', fontSize: '16px', fontWeight: '600'}, text: 'Dual Moving Average (5,9)'},
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

      <CollapsibleCard title="All Sample Values">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b demo-divider">
                <th className="text-left py-2 px-3 demo-muted font-medium">Period</th>
                <th className="text-left py-2 px-3 demo-muted font-medium">Date</th>
                <th className="text-left py-2 px-3 demo-muted font-medium">Close</th>
                <th className="text-left py-2 px-3 demo-muted font-medium">Short MA</th>
                <th className="text-left py-2 px-3 demo-muted font-medium">Long MA</th>
                <th className="text-left py-2 px-3 demo-muted font-medium">Signal</th>
              </tr>
            </thead>
            <tbody>
              {sampleValues.map((row, idx) => (
                <tr key={idx} className="border-b demo-divider">
                  <td className="py-2 px-3 demo-text font-mono">{row.period}</td>
                  <td className="py-2 px-3 demo-text">{row.date}</td>
                  <td className="py-2 px-3 demo-text">${row.close.toFixed(2)}</td>
                  <td className="py-2 px-3 demo-text font-mono">{row.short}</td>
                  <td className="py-2 px-3 demo-text font-mono">{row.long}</td>
                  <td className="py-2 px-3">
                    <SignalBadge signal={row.signal} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CollapsibleCard>
    </div>
  );
};

export const DMA: IndicatorConfig = {
  color: '#22d3ee',
  createIndicator: () => new DMAClass(5, 9, SMA),
  customRender: renderDMA,
  description: 'Dual Moving Average',
  details:
    'Compares two moving averages. When the short MA crosses above the long MA, it signals a potential buy opportunity.',
  id: 'dma',
  name: 'DMA',
  requiredInputs: 9,
  type: 'custom',
};
