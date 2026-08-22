import {CollapsibleCard} from '../../components/CollapsibleCard';
import {Chart as HighchartsChart} from '@highcharts/react';
import {TTMSqueeze as TTMSqueezeClass} from 'trading-signals';
import type {ReactNode} from 'react';
import type {Candle} from '@typedtrader/exchange';
import {createSharedTooltipFormatter} from '../../components/Chart';
import {NotAvailable} from '../../components/NotAvailable';
import PriceChart, {type PriceData} from '../../components/PriceChart';
import {SignalBadge} from '../../components/SignalBadge';
import {formatDate} from '../../utils/formatDate';
import {collectPriceData} from '../../utils/renderUtils';
import type {IndicatorConfig} from '../../utils/types';

type HistogramPoint = {x: number; y: number | null; color?: string};

/** LazyBear's histogram look: bright while momentum builds, dark while it fades. */
const momentumColor = (momentum: number, previous: number | null) => {
  const isBuilding = previous === null || Math.abs(momentum) > Math.abs(previous);

  if (momentum >= 0) {
    return isBuilding ? '#84cc16' : '#15803d';
  }

  return isBuilding ? '#ef4444' : '#7f1d1d';
};

const renderTTMSqueeze = (config: IndicatorConfig, selectedCandles: Candle[]) => {
  const squeeze = new TTMSqueezeClass();
  const chartDataMomentum: HistogramPoint[] = [];
  const chartDataSqueeze: HistogramPoint[] = [];
  const priceData: PriceData[] = [];
  const sampleValues: {
    period: number;
    date: string;
    close: number;
    momentum: ReactNode;
    squeezed: string;
    signal: string;
  }[] = [];
  let previousMomentum: number | null = null;

  selectedCandles.forEach((candle, idx) => {
    squeeze.add({close: Number(candle.close), high: Number(candle.high), low: Number(candle.low)});
    const result = squeeze.getResult();
    const trendSignal = squeeze.getSignal();

    chartDataMomentum.push({
      color: result ? momentumColor(result.momentum, previousMomentum) : undefined,
      x: idx + 1,
      y: result?.momentum ?? null,
    });
    chartDataSqueeze.push({
      color: result?.isSqueezed ? '#f59e0b' : '#64748b',
      x: idx + 1,
      y: result ? 0 : null,
    });
    previousMomentum = result?.momentum ?? previousMomentum;

    priceData.push(collectPriceData(candle, idx));

    sampleValues.push({
      close: Number(candle.close),
      date: formatDate(candle.openTimeInISO),
      momentum: result ? result.momentum.toFixed(4) : <NotAvailable />,
      period: idx + 1,
      signal: trendSignal.state,
      squeezed: result ? (result.isSqueezed ? 'Yes' : 'No') : '-',
    });
  });

  return (
    <div className="space-y-6">
      <div className="demo-card">
        <HighchartsChart
          options={{
            chart: {backgroundColor: 'transparent', height: 300, type: 'column'},
            credits: {enabled: false},
            legend: {enabled: true, itemStyle: {color: '#e2e8f0'}},
            plotOptions: {
              column: {borderWidth: 0},
              line: {lineWidth: 0, marker: {enabled: true, radius: 3}},
            },
            series: [
              {
                color: config.color,
                data: chartDataMomentum.map(point => ({color: point.color, x: point.x, y: point.y})),
                name: 'Momentum',
                type: 'column',
              },
              {
                color: '#f59e0b',
                data: chartDataSqueeze.map(point => ({color: point.color, x: point.x, y: point.y})),
                name: 'Squeeze',
                type: 'line',
              },
            ],
            title: {style: {color: '#e2e8f0', fontSize: '16px', fontWeight: '600'}, text: 'TTM Squeeze (20, 2, 1.5)'},
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
              title: {style: {color: '#94a3b8'}, text: 'Momentum'},
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
                <th className="text-left demo-text py-2 px-3">Momentum</th>
                <th className="text-left demo-text py-2 px-3">Squeeze</th>
                <th className="text-left demo-text py-2 px-3">Signal</th>
              </tr>
            </thead>
            <tbody>
              {sampleValues.map(row => (
                <tr key={row.period} className="border-b demo-divider">
                  <td className="demo-muted py-2 px-3">{row.period}</td>
                  <td className="demo-text py-2 px-3">{row.date}</td>
                  <td className="demo-text py-2 px-3">${row.close.toFixed(2)}</td>
                  <td className="demo-text font-mono py-2 px-3">{row.momentum}</td>
                  <td className="demo-text py-2 px-3">{row.squeezed}</td>
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

export const TTMSqueeze: IndicatorConfig = {
  color: '#84cc16',
  createIndicator: () => new TTMSqueezeClass(),
  customRender: renderTTMSqueeze,
  description: 'TTM Squeeze (Squeeze Momentum)',
  id: 'ttm-squeeze',
  name: 'TTM Squeeze',
  requiredInputs: 39,
  type: 'custom',
};
