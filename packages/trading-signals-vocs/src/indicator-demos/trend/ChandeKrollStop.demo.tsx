import {CollapsibleCard} from '../../components/CollapsibleCard';
import {Chart as HighchartsChart} from '@highcharts/react';
import {ChandeKrollStop as ChandeKrollStopClass} from 'trading-signals';
import type {ReactNode} from 'react';
import type {Candle} from '@typedtrader/exchange';
import {createSharedTooltipFormatter, type ChartDataPoint} from '../../components/Chart';
import {NotAvailable} from '../../components/NotAvailable';
import PriceChart, {type PriceData} from '../../components/PriceChart';
import {formatDate} from '../../utils/formatDate';
import {collectPriceData} from '../../utils/renderUtils';
import type {IndicatorConfig} from '../../utils/types';

const renderChandeKrollStop = (config: IndicatorConfig, selectedCandles: Candle[]) => {
  const cks = new ChandeKrollStopClass();
  const chartDataClose: ChartDataPoint[] = [];
  const chartDataLongStop: ChartDataPoint[] = [];
  const chartDataShortStop: ChartDataPoint[] = [];
  const priceData: PriceData[] = [];
  const sampleValues: {period: number; date: string; close: number; longStop: ReactNode; shortStop: ReactNode}[] = [];

  selectedCandles.forEach((candle, idx) => {
    const result = cks.add({close: Number(candle.close), high: Number(candle.high), low: Number(candle.low)});
    chartDataClose.push({x: idx + 1, y: Number(candle.close)});
    chartDataLongStop.push({x: idx + 1, y: result?.longStop ?? null});
    chartDataShortStop.push({x: idx + 1, y: result?.shortStop ?? null});

    priceData.push(collectPriceData(candle, idx));

    sampleValues.push({
      close: Number(candle.close),
      date: formatDate(candle.openTimeInISO),
      longStop: result ? result.longStop.toFixed(2) : <NotAvailable />,
      period: idx + 1,
      shortStop: result ? result.shortStop.toFixed(2) : <NotAvailable />,
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
                data: chartDataLongStop.map(point => [point.x, point.y]),
                marker: {fillColor: '#10b981'},
                name: 'Long Stop',
                type: 'line',
              },
              {
                color: '#ef4444',
                data: chartDataShortStop.map(point => [point.x, point.y]),
                marker: {fillColor: '#ef4444'},
                name: 'Short Stop',
                type: 'line',
              },
            ],
            title: {
              style: {color: '#e2e8f0', fontSize: '16px', fontWeight: '600'},
              text: 'Chande Kroll Stop (10, 1, 9)',
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
          <table className="w-full">
            <thead>
              <tr className="border-b demo-divider">
                <th className="text-left py-2 px-3 demo-muted font-medium">Period</th>
                <th className="text-left py-2 px-3 demo-muted font-medium">Date</th>
                <th className="text-left py-2 px-3 demo-muted font-medium">Close</th>
                <th className="text-left py-2 px-3 demo-muted font-medium">Long Stop</th>
                <th className="text-left py-2 px-3 demo-muted font-medium">Short Stop</th>
              </tr>
            </thead>
            <tbody>
              {sampleValues.map((row, idx) => (
                <tr key={idx} className="border-b demo-divider">
                  <td className="py-2 px-3 demo-text font-mono">{row.period}</td>
                  <td className="py-2 px-3 demo-text">{row.date}</td>
                  <td className="py-2 px-3 demo-text">${row.close.toFixed(2)}</td>
                  <td className="py-2 px-3 demo-text font-mono">{row.longStop}</td>
                  <td className="py-2 px-3 demo-text font-mono">{row.shortStop}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CollapsibleCard>
    </div>
  );
};

export const ChandeKrollStop: IndicatorConfig = {
  color: '#10b981',
  createIndicator: () => new ChandeKrollStopClass(),
  customRender: renderChandeKrollStop,
  description: 'Chande Kroll Stop',
  details:
    'Two volatility-adjusted trailing stops derived in two passes: a preliminary short stop hangs one ATR below the highest high, a preliminary long stop sits one ATR above the lowest low, and the final lines take the most conservative preliminary stop of the last nine bars. Price crossing below the long stop exits longs; price crossing above the short stop exits shorts.',
  id: 'chande-kroll-stop',
  name: 'Chande Kroll Stop',
  requiredInputs: 18,
  type: 'custom',
};
