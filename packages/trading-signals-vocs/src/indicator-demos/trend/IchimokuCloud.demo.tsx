import {CollapsibleCard} from '../../components/CollapsibleCard';
import {Chart as HighchartsChart} from '@highcharts/react';
import {IchimokuCloud as IchimokuCloudClass} from 'trading-signals';
import type {ReactNode} from 'react';
import type {Candle} from '@typedtrader/exchange';
import {createSharedTooltipFormatter, type ChartDataPoint} from '../../components/Chart';
import {NotAvailable} from '../../components/NotAvailable';
import PriceChart, {type PriceData} from '../../components/PriceChart';
import {formatDate} from '../../utils/formatDate';
import {collectPriceData} from '../../utils/renderUtils';
import type {IndicatorConfig} from '../../utils/types';

const renderIchimokuCloud = (config: IndicatorConfig, selectedCandles: Candle[]) => {
  const ichimoku = new IchimokuCloudClass();
  const chartDataConversion: ChartDataPoint[] = [];
  const chartDataBase: ChartDataPoint[] = [];
  const chartDataSpanA: ChartDataPoint[] = [];
  const chartDataSpanB: ChartDataPoint[] = [];
  const priceData: PriceData[] = [];
  const sampleValues: {
    period: number;
    date: string;
    close: number;
    conversion: ReactNode;
    base: ReactNode;
    spanA: ReactNode;
    spanB: ReactNode;
  }[] = [];

  selectedCandles.forEach((candle, idx) => {
    const result = ichimoku.add({high: Number(candle.high), low: Number(candle.low)});

    chartDataConversion.push({x: idx + 1, y: result?.conversion ?? null});
    chartDataBase.push({x: idx + 1, y: result?.base ?? null});
    chartDataSpanA.push({x: idx + 1, y: result?.spanA ?? null});
    chartDataSpanB.push({x: idx + 1, y: result?.spanB ?? null});

    priceData.push(collectPriceData(candle, idx));

    sampleValues.push({
      base: result ? result.base.toFixed(2) : <NotAvailable />,
      close: Number(candle.close),
      conversion: result ? result.conversion.toFixed(2) : <NotAvailable />,
      date: formatDate(candle.openTimeInISO),
      period: idx + 1,
      spanA: result ? result.spanA.toFixed(2) : <NotAvailable />,
      spanB: result ? result.spanB.toFixed(2) : <NotAvailable />,
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
                data: chartDataConversion.map(point => [point.x, point.y]),
                marker: {fillColor: config.color},
                name: 'Conversion (Tenkan-sen)',
                type: 'line',
              },
              {
                color: '#ef4444',
                data: chartDataBase.map(point => [point.x, point.y]),
                marker: {fillColor: '#ef4444'},
                name: 'Base (Kijun-sen)',
                type: 'line',
              },
              {
                color: '#10b981',
                data: chartDataSpanA.map(point => [point.x, point.y]),
                marker: {fillColor: '#10b981'},
                name: 'Span A (Senkou A)',
                type: 'line',
              },
              {
                color: '#f97316',
                data: chartDataSpanB.map(point => [point.x, point.y]),
                marker: {fillColor: '#f97316'},
                name: 'Span B (Senkou B)',
                type: 'line',
              },
            ],
            title: {style: {color: '#e2e8f0', fontSize: '16px', fontWeight: '600'}, text: 'Ichimoku Cloud (9, 26, 52)'},
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
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b demo-divider">
                <th className="text-left py-2 px-3 demo-muted font-medium">Period</th>
                <th className="text-left py-2 px-3 demo-muted font-medium">Date</th>
                <th className="text-left py-2 px-3 demo-muted font-medium">Close</th>
                <th className="text-left py-2 px-3 demo-muted font-medium">Conversion</th>
                <th className="text-left py-2 px-3 demo-muted font-medium">Base</th>
                <th className="text-left py-2 px-3 demo-muted font-medium">Span A</th>
                <th className="text-left py-2 px-3 demo-muted font-medium">Span B</th>
              </tr>
            </thead>
            <tbody>
              {sampleValues.map(row => (
                <tr key={row.period} className="border-b demo-divider">
                  <td className="py-2 px-3 demo-text font-mono">{row.period}</td>
                  <td className="py-2 px-3 demo-text">{row.date}</td>
                  <td className="py-2 px-3 demo-text">${row.close.toFixed(2)}</td>
                  <td className="py-2 px-3 demo-text font-mono">{row.conversion}</td>
                  <td className="py-2 px-3 demo-text font-mono">{row.base}</td>
                  <td className="py-2 px-3 demo-text font-mono">{row.spanA}</td>
                  <td className="py-2 px-3 demo-text font-mono">{row.spanB}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CollapsibleCard>
    </div>
  );
};

export const IchimokuCloud: IndicatorConfig = {
  color: '#3b82f6',
  createIndicator: () => new IchimokuCloudClass(),
  customRender: renderIchimokuCloud,
  description: 'Ichimoku Cloud',
  details:
    'Maps trend and equilibrium at a glance: each line is the midpoint between the highest high and the lowest low of its window, and the two spans enclose the cloud that traders read as support and resistance. All values are computed at the current bar — the traditional 26-bar forward displacement of the cloud is left to the chart.',
  id: 'ichimoku',
  name: 'Ichimoku Cloud',
  requiredInputs: 52,
  type: 'custom',
};
