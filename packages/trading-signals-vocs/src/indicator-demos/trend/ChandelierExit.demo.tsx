import {CollapsibleCard} from '../../components/CollapsibleCard';
import {Chart as HighchartsChart} from '@highcharts/react';
import {ChandelierExit as ChandelierExitClass} from 'trading-signals';
import type {ReactNode} from 'react';
import type {Candle} from '@typedtrader/exchange';
import {createSharedTooltipFormatter, type ChartDataPoint} from '../../components/Chart';
import {NotAvailable} from '../../components/NotAvailable';
import PriceChart, {type PriceData} from '../../components/PriceChart';
import {formatDate} from '../../utils/formatDate';
import {collectPriceData} from '../../utils/renderUtils';
import type {IndicatorConfig} from '../../utils/types';

const renderChandelierExit = (config: IndicatorConfig, selectedCandles: Candle[]) => {
  const ce = new ChandelierExitClass();
  const chartDataClose: ChartDataPoint[] = [];
  const chartDataLong: ChartDataPoint[] = [];
  const chartDataShort: ChartDataPoint[] = [];
  const priceData: PriceData[] = [];
  const sampleValues: {period: number; date: string; close: number; long: ReactNode; short: ReactNode}[] = [];

  selectedCandles.forEach((candle, idx) => {
    const result = ce.add({close: Number(candle.close), high: Number(candle.high), low: Number(candle.low)});
    chartDataClose.push({x: idx + 1, y: Number(candle.close)});
    chartDataLong.push({x: idx + 1, y: result?.long ?? null});
    chartDataShort.push({x: idx + 1, y: result?.short ?? null});

    priceData.push(collectPriceData(candle, idx));

    sampleValues.push({
      close: Number(candle.close),
      date: formatDate(candle.openTimeInISO),
      long: result ? result.long.toFixed(2) : <NotAvailable />,
      period: idx + 1,
      short: result ? result.short.toFixed(2) : <NotAvailable />,
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
                color: '#94a3b8',
                data: chartDataClose.map(point => [point.x, point.y]),
                marker: {fillColor: '#94a3b8'},
                name: 'Close',
                type: 'line',
              },
              {
                color: '#10b981',
                data: chartDataLong.map(point => [point.x, point.y]),
                marker: {fillColor: '#10b981'},
                name: 'Long Exit',
                type: 'line',
              },
              {
                color: '#ef4444',
                data: chartDataShort.map(point => [point.x, point.y]),
                marker: {fillColor: '#ef4444'},
                name: 'Short Exit',
                type: 'line',
              },
            ],
            title: {style: {color: '#e2e8f0', fontSize: '16px', fontWeight: '600'}, text: 'Chandelier Exit (22, 3)'},
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
                <th className="text-left py-2 px-3 demo-muted font-medium">Long Exit</th>
                <th className="text-left py-2 px-3 demo-muted font-medium">Short Exit</th>
              </tr>
            </thead>
            <tbody>
              {sampleValues.map((row, idx) => (
                <tr key={idx} className="border-b demo-divider">
                  <td className="py-2 px-3 demo-text font-mono">{row.period}</td>
                  <td className="py-2 px-3 demo-text">{row.date}</td>
                  <td className="py-2 px-3 demo-text">${row.close.toFixed(2)}</td>
                  <td className="py-2 px-3 demo-text font-mono">{row.long}</td>
                  <td className="py-2 px-3 demo-text font-mono">{row.short}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CollapsibleCard>
    </div>
  );
};

export const ChandelierExit: IndicatorConfig = {
  color: '#10b981',
  createIndicator: () => new ChandelierExitClass(),
  customRender: renderChandelierExit,
  description: 'Chandelier Exit',
  details:
    'A volatility-adjusted trailing stop: the long exit hangs three ATRs below the highest high of the lookback, the short exit mirrors it above the lowest low. Volatile markets get more room to breathe, quiet markets get a tighter stop.',
  id: 'chandelier-exit',
  name: 'Chandelier Exit',
  requiredInputs: 22,
  type: 'custom',
};
