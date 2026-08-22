import {CollapsibleCard} from '../../components/CollapsibleCard';
import {Chart as HighchartsChart} from '@highcharts/react';
import {Alligator as AlligatorClass} from 'trading-signals';
import type {ReactNode} from 'react';
import type {Candle} from '@typedtrader/exchange';
import {createSharedTooltipFormatter, type ChartDataPoint} from '../../components/Chart';
import {NotAvailable} from '../../components/NotAvailable';
import PriceChart, {type PriceData} from '../../components/PriceChart';
import {formatDate} from '../../utils/formatDate';
import {collectPriceData} from '../../utils/renderUtils';
import type {IndicatorConfig} from '../../utils/types';

const renderAlligator = (config: IndicatorConfig, selectedCandles: Candle[]) => {
  const alligator = new AlligatorClass();
  const chartDataJaw: ChartDataPoint[] = [];
  const chartDataTeeth: ChartDataPoint[] = [];
  const chartDataLips: ChartDataPoint[] = [];
  const priceData: PriceData[] = [];
  const sampleValues: {
    period: number;
    date: string;
    close: number;
    jaw: ReactNode;
    teeth: ReactNode;
    lips: ReactNode;
  }[] = [];

  selectedCandles.forEach((candle, idx) => {
    const result = alligator.add({high: Number(candle.high), low: Number(candle.low)});

    chartDataJaw.push({x: idx + 1, y: result?.jaw ?? null});
    chartDataTeeth.push({x: idx + 1, y: result?.teeth ?? null});
    chartDataLips.push({x: idx + 1, y: result?.lips ?? null});

    priceData.push(collectPriceData(candle, idx));

    sampleValues.push({
      close: Number(candle.close),
      date: formatDate(candle.openTimeInISO),
      jaw: result ? result.jaw.toFixed(2) : <NotAvailable />,
      lips: result ? result.lips.toFixed(2) : <NotAvailable />,
      period: idx + 1,
      teeth: result ? result.teeth.toFixed(2) : <NotAvailable />,
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
                data: chartDataJaw.map(point => [point.x, point.y]),
                marker: {fillColor: config.color},
                name: 'Jaw (SMMA 13, +8)',
                type: 'line',
              },
              {
                color: '#ef4444',
                data: chartDataTeeth.map(point => [point.x, point.y]),
                marker: {fillColor: '#ef4444'},
                name: 'Teeth (SMMA 8, +5)',
                type: 'line',
              },
              {
                color: '#10b981',
                data: chartDataLips.map(point => [point.x, point.y]),
                marker: {fillColor: '#10b981'},
                name: 'Lips (SMMA 5, +3)',
                type: 'line',
              },
            ],
            title: {
              style: {color: '#e2e8f0', fontSize: '16px', fontWeight: '600'},
              text: 'Williams Alligator (13/8, 8/5, 5/3)',
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

      <CollapsibleCard title="All Sample Values">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b demo-divider">
                <th className="text-left py-2 px-3 demo-muted font-medium">Period</th>
                <th className="text-left py-2 px-3 demo-muted font-medium">Date</th>
                <th className="text-left py-2 px-3 demo-muted font-medium">Close</th>
                <th className="text-left py-2 px-3 demo-muted font-medium">Jaw</th>
                <th className="text-left py-2 px-3 demo-muted font-medium">Teeth</th>
                <th className="text-left py-2 px-3 demo-muted font-medium">Lips</th>
              </tr>
            </thead>
            <tbody>
              {sampleValues.map(row => (
                <tr key={row.period} className="border-b demo-divider">
                  <td className="py-2 px-3 demo-text font-mono">{row.period}</td>
                  <td className="py-2 px-3 demo-text">{row.date}</td>
                  <td className="py-2 px-3 demo-text">${row.close.toFixed(2)}</td>
                  <td className="py-2 px-3 demo-text font-mono">{row.jaw}</td>
                  <td className="py-2 px-3 demo-text font-mono">{row.teeth}</td>
                  <td className="py-2 px-3 demo-text font-mono">{row.lips}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CollapsibleCard>
    </div>
  );
};

export const Alligator: IndicatorConfig = {
  color: '#3b82f6',
  createIndicator: () => new AlligatorClass(),
  customRender: renderAlligator,
  description: 'Williams Alligator',
  details:
    'Bill Williams reads the market as an alligator that sleeps, awakens and eats: three smoothed moving averages of the median price form its jaw (13 bars), teeth (8 bars) and lips (5 bars). Because each line is displaced forward by a different amount (8, 5 and 3 bars) and their alignment is the indicator, the displacement is applied internally — every value shown is the one its line produced that many bars earlier.',
  id: 'alligator',
  name: 'Williams Alligator',
  requiredInputs: 21,
  type: 'custom',
};
