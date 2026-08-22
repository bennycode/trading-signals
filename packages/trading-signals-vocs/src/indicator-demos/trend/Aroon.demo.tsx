import {CollapsibleCard} from '../../components/CollapsibleCard';
import {Chart as HighchartsChart} from '@highcharts/react';
import {Aroon as AroonClass} from 'trading-signals';
import type {ReactNode} from 'react';
import type {Candle} from '@typedtrader/exchange';
import {createSharedTooltipFormatter, type ChartDataPoint} from '../../components/Chart';
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
      <div className="demo-card">
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
              max: 100,
              min: 0,
              title: {style: {color: '#94a3b8'}, text: 'Aroon'},
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
                <th className="text-left py-2 px-3 demo-muted font-medium">Aroon Up</th>
                <th className="text-left py-2 px-3 demo-muted font-medium">Aroon Down</th>
              </tr>
            </thead>
            <tbody>
              {sampleValues.map((row, idx) => (
                <tr key={idx} className="border-b demo-divider">
                  <td className="py-2 px-3 demo-text font-mono">{row.period}</td>
                  <td className="py-2 px-3 demo-text">{row.date}</td>
                  <td className="py-2 px-3 demo-text">${row.close.toFixed(2)}</td>
                  <td className="py-2 px-3 demo-text font-mono">{row.up}</td>
                  <td className="py-2 px-3 demo-text font-mono">{row.down}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CollapsibleCard>
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
