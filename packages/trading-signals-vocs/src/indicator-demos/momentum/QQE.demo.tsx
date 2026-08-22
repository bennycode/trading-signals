import {Chart as HighchartsChart} from '@highcharts/react';
import {QQE as QQEClass} from 'trading-signals';
import type {ReactNode} from 'react';
import type {Candle} from '@typedtrader/exchange';
import {CollapsibleCard} from '../../components/CollapsibleCard';
import {createSharedTooltipFormatter, type ChartDataPoint} from '../../components/Chart';
import {NotAvailable} from '../../components/NotAvailable';
import PriceChart, {type PriceData} from '../../components/PriceChart';
import {SignalBadge} from '../../components/SignalBadge';
import {formatDate} from '../../utils/formatDate';
import {collectPriceData} from '../../utils/renderUtils';
import type {IndicatorConfig} from '../../utils/types';

// The fast preset of the original QQE (RSI 6, smoothing 3, factor 2.618) keeps the warm-up short enough for small datasets
const createQQE = () => new QQEClass({fastFactor: 2.618, rsiInterval: 6, smoothInterval: 3});

const renderQQE = (config: IndicatorConfig, selectedCandles: Candle[]) => {
  const qqe = createQQE();
  const chartDataRsiMa: ChartDataPoint[] = [];
  const chartDataTrailingStop: ChartDataPoint[] = [];
  const priceData: PriceData[] = [];
  const sampleValues: {
    period: number;
    date: string;
    close: number;
    rsiMa: ReactNode;
    trailingStop: ReactNode;
    signal: string;
  }[] = [];

  selectedCandles.forEach((candle, idx) => {
    const result = qqe.add(Number(candle.close));
    const signal = qqe.getSignal();
    chartDataRsiMa.push({x: idx + 1, y: result?.rsiMa ?? null});
    chartDataTrailingStop.push({x: idx + 1, y: result?.trailingStop ?? null});

    priceData.push(collectPriceData(candle, idx));

    sampleValues.push({
      close: Number(candle.close),
      date: formatDate(candle.openTimeInISO),
      period: idx + 1,
      rsiMa: result ? result.rsiMa.toFixed(2) : <NotAvailable />,
      signal: signal.state,
      trailingStop: result ? result.trailingStop.toFixed(2) : <NotAvailable />,
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
                data: chartDataRsiMa.map(point => [point.x, point.y]),
                marker: {fillColor: config.color},
                name: 'RSI MA',
                type: 'line',
              },
              {
                color: '#38bdf8',
                data: chartDataTrailingStop.map(point => [point.x, point.y]),
                marker: {fillColor: '#38bdf8'},
                name: 'Trailing Stop',
                type: 'line',
              },
            ],
            title: {style: {color: '#e2e8f0', fontSize: '16px', fontWeight: '600'}, text: 'QQE (6, 3, 2.618)'},
            tooltip: {
              backgroundColor: '#1e293b',
              borderColor: '#475569',
              formatter: createSharedTooltipFormatter(y => y.toFixed(2)),
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
              title: {style: {color: '#94a3b8'}, text: 'RSI'},
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
                <th className="text-left demo-text py-2 px-3">RSI MA</th>
                <th className="text-left demo-text py-2 px-3">Trailing Stop</th>
                <th className="text-left demo-text py-2 px-3">Signal</th>
              </tr>
            </thead>
            <tbody>
              {sampleValues.map(row => (
                <tr key={row.period} className="border-b demo-divider">
                  <td className="demo-muted py-2 px-3">{row.period}</td>
                  <td className="demo-text py-2 px-3">{row.date}</td>
                  <td className="demo-text py-2 px-3">${row.close.toFixed(2)}</td>
                  <td className="demo-text font-mono py-2 px-3">{row.rsiMa}</td>
                  <td className="demo-text font-mono py-2 px-3">{row.trailingStop}</td>
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

export const QQE: IndicatorConfig = {
  color: '#f59e0b',
  createIndicator: createQQE,
  customRender: renderQQE,
  description: 'Quantitative Qualitative Estimation',
  details:
    'Smooths the RSI into a calmer line and trails a volatility-based stop behind it — the SuperTrend construction applied to the RSI instead of price. The side the smoothed RSI takes of its trailing stop names the momentum direction; a flip of the stop line marks a momentum reversal.',
  id: 'qqe',
  name: 'QQE',
  requiredInputs: 30,
  type: 'custom',
};
