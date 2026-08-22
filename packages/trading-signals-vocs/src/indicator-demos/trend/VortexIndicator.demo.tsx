import {CollapsibleCard} from '../../components/CollapsibleCard';
import {Chart as HighchartsChart} from '@highcharts/react';
import {VortexIndicator as VortexIndicatorClass} from 'trading-signals';
import type {ReactNode} from 'react';
import type {Candle} from '@typedtrader/exchange';
import {createSharedTooltipFormatter, type ChartDataPoint} from '../../components/Chart';
import {NotAvailable} from '../../components/NotAvailable';
import PriceChart, {type PriceData} from '../../components/PriceChart';
import {SignalBadge} from '../../components/SignalBadge';
import {formatDate} from '../../utils/formatDate';
import {collectPriceData} from '../../utils/renderUtils';
import type {IndicatorConfig} from '../../utils/types';

const renderVortexIndicator = (config: IndicatorConfig, selectedCandles: Candle[]) => {
  const vortex = new VortexIndicatorClass(14);
  const chartDataPlus: ChartDataPoint[] = [];
  const chartDataMinus: ChartDataPoint[] = [];
  const priceData: PriceData[] = [];
  const sampleValues: {
    period: number;
    date: string;
    close: number;
    plus: ReactNode;
    minus: ReactNode;
    signal: string;
  }[] = [];

  selectedCandles.forEach((candle, idx) => {
    const result = vortex.add({close: Number(candle.close), high: Number(candle.high), low: Number(candle.low)});
    const trendSignal = vortex.getSignal();
    chartDataPlus.push({x: idx + 1, y: result?.plus ?? null});
    chartDataMinus.push({x: idx + 1, y: result?.minus ?? null});

    priceData.push(collectPriceData(candle, idx));

    sampleValues.push({
      close: Number(candle.close),
      date: formatDate(candle.openTimeInISO),
      minus: result ? result.minus.toFixed(4) : <NotAvailable />,
      period: idx + 1,
      plus: result ? result.plus.toFixed(4) : <NotAvailable />,
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
                color: '#10b981',
                data: chartDataPlus.map(point => [point.x, point.y]),
                marker: {fillColor: '#10b981'},
                name: 'VI+',
                type: 'line',
              },
              {
                color: '#ef4444',
                data: chartDataMinus.map(point => [point.x, point.y]),
                marker: {fillColor: '#ef4444'},
                name: 'VI−',
                type: 'line',
              },
            ],
            title: {style: {color: '#e2e8f0', fontSize: '16px', fontWeight: '600'}, text: 'Vortex Indicator (14)'},
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
              title: {style: {color: '#94a3b8'}, text: 'Vortex'},
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
                <th className="text-left demo-text py-2 px-3">VI+</th>
                <th className="text-left demo-text py-2 px-3">VI−</th>
                <th className="text-left demo-text py-2 px-3">Signal</th>
              </tr>
            </thead>
            <tbody>
              {sampleValues.map(row => (
                <tr key={row.period} className="border-b demo-divider">
                  <td className="demo-muted py-2 px-3">{row.period}</td>
                  <td className="demo-text py-2 px-3">{row.date}</td>
                  <td className="demo-text py-2 px-3">${row.close.toFixed(2)}</td>
                  <td className="demo-text font-mono py-2 px-3">{row.plus}</td>
                  <td className="demo-text font-mono py-2 px-3">{row.minus}</td>
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

export const VortexIndicator: IndicatorConfig = {
  color: '#10b981',
  createIndicator: () => new VortexIndicatorClass(14),
  customRender: renderVortexIndicator,
  description: 'Vortex Indicator',
  details:
    'Tracks upward and downward trend movement as two lines normalized by the true range. The upper line names the side in control; a crossover of VI+ and VI− suggests a trend change.',
  id: 'vortex',
  name: 'Vortex Indicator',
  requiredInputs: 15,
  type: 'custom',
};
