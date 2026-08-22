import {CollapsibleCard} from '../../components/CollapsibleCard';
import {Chart as HighchartsChart} from '@highcharts/react';
import {MAMA as MAMAClass} from 'trading-signals';
import type {ReactNode} from 'react';
import type {Candle} from '@typedtrader/exchange';
import {createSharedTooltipFormatter, type ChartDataPoint} from '../../components/Chart';
import {NotAvailable} from '../../components/NotAvailable';
import PriceChart, {type PriceData} from '../../components/PriceChart';
import {SignalBadge} from '../../components/SignalBadge';
import {formatDate} from '../../utils/formatDate';
import {collectPriceData} from '../../utils/renderUtils';
import type {IndicatorConfig} from '../../utils/types';

const renderMAMA = (config: IndicatorConfig, selectedCandles: Candle[]) => {
  const mama = new MAMAClass();
  const chartDataMAMA: ChartDataPoint[] = [];
  const chartDataFAMA: ChartDataPoint[] = [];
  const priceData: PriceData[] = [];
  const sampleValues: {
    period: number;
    date: string;
    close: number;
    mama: ReactNode;
    fama: ReactNode;
    signal: string;
  }[] = [];

  selectedCandles.forEach((candle, idx) => {
    const result = mama.add(Number(candle.close));
    const trendSignal = mama.getSignal();
    chartDataMAMA.push({x: idx + 1, y: result?.mama ?? null});
    chartDataFAMA.push({x: idx + 1, y: result?.fama ?? null});

    priceData.push(collectPriceData(candle, idx));

    sampleValues.push({
      close: Number(candle.close),
      date: formatDate(candle.openTimeInISO),
      fama: result ? result.fama.toFixed(4) : <NotAvailable />,
      mama: result ? result.mama.toFixed(4) : <NotAvailable />,
      period: idx + 1,
      signal: trendSignal.state,
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
                data: chartDataMAMA.map(point => [point.x, point.y]),
                marker: {fillColor: config.color},
                name: 'MAMA',
                type: 'line',
              },
              {
                color: '#f97316',
                data: chartDataFAMA.map(point => [point.x, point.y]),
                marker: {fillColor: '#f97316'},
                name: 'FAMA',
                type: 'line',
              },
            ],
            title: {style: {color: '#e2e8f0', fontSize: '16px', fontWeight: '600'}, text: 'MAMA (0.5, 0.05)'},
            tooltip: {
              backgroundColor: '#1e293b',
              borderColor: '#475569',
              formatter: createSharedTooltipFormatter(y => y.toFixed(4)),
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
                <th className="text-left demo-text py-2 px-3">Period</th>
                <th className="text-left demo-text py-2 px-3">Date</th>
                <th className="text-left demo-text py-2 px-3">Close</th>
                <th className="text-left demo-text py-2 px-3">MAMA</th>
                <th className="text-left demo-text py-2 px-3">FAMA</th>
                <th className="text-left demo-text py-2 px-3">Signal</th>
              </tr>
            </thead>
            <tbody>
              {sampleValues.map(row => (
                <tr key={row.period} className="border-b demo-divider">
                  <td className="demo-muted py-2 px-3">{row.period}</td>
                  <td className="demo-text py-2 px-3">{row.date}</td>
                  <td className="demo-text py-2 px-3">${row.close.toFixed(2)}</td>
                  <td className="demo-text font-mono py-2 px-3">{row.mama}</td>
                  <td className="demo-text font-mono py-2 px-3">{row.fama}</td>
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

export const MAMA: IndicatorConfig = {
  color: '#3b82f6',
  createIndicator: () => new MAMAClass(),
  customRender: renderMAMA,
  description: 'MESA Adaptive Moving Average',
  details:
    'Adapts its smoothing to the dominant market cycle measured by a Hilbert transform: it hugs price during trends and freezes in congestion. MAMA crossing above its following average (FAMA) signals bullish pressure, crossing below signals bearish pressure.',
  id: 'mama',
  name: 'MAMA',
  requiredInputs: 33,
  type: 'custom',
};
