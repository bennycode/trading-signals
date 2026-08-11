import {Chart as HighchartsChart} from '@highcharts/react';
import {WaddahAttarExplosion as WaddahAttarExplosionClass} from 'trading-signals';
import type {ReactNode} from 'react';
import type {Candle} from '@typedtrader/exchange';
import {createSharedTooltipFormatter} from '../../components/Chart';
import {NotAvailable} from '../../components/NotAvailable';
import PriceChart, {type PriceData} from '../../components/PriceChart';
import {SignalBadge} from '../../components/SignalBadge';
import {formatDate} from '../../utils/formatDate';
import {collectPriceData} from '../../utils/renderUtils';
import type {IndicatorConfig} from '../../utils/types';

/*
 * The demo shrinks the SHK lookbacks (EMA 20/40, BB 20, ATR 100) to EMA 10/20, BB 10, ATR 20 so the
 * indicator warms up within the 40-candle sample datasets; sensitivity, band width and dead zone
 * multiplier stay at their published defaults.
 */
const createWaddahAttarExplosion = () =>
  new WaddahAttarExplosionClass({atrInterval: 20, bandsInterval: 10, longInterval: 20, shortInterval: 10});

const renderWaddahAttarExplosion = (config: IndicatorConfig, selectedCandles: Candle[]) => {
  const wae = createWaddahAttarExplosion();
  const chartDataTrend: {color: string; x: number; y: number | null}[] = [];
  const chartDataExplosion: [number, number | null][] = [];
  const chartDataDeadZone: [number, number | null][] = [];
  const priceData: PriceData[] = [];
  const sampleValues: {
    period: number;
    date: string;
    close: number;
    trend: ReactNode;
    explosion: ReactNode;
    deadZone: ReactNode;
    signal: string;
  }[] = [];

  selectedCandles.forEach((candle, idx) => {
    wae.add({close: Number(candle.close), high: Number(candle.high), low: Number(candle.low)});
    const result = wae.isStable ? wae.getResult() : null;
    const signal = wae.getSignal();
    const trend = result?.trend ?? 0;
    chartDataTrend.push({
      color: trend > 0 ? '#22c55e' : trend < 0 ? '#ef4444' : '#64748b',
      x: idx + 1,
      y: result?.trend ?? null,
    });
    chartDataExplosion.push([idx + 1, result?.explosion ?? null]);
    chartDataDeadZone.push([idx + 1, result?.deadZone ?? null]);

    priceData.push(collectPriceData(candle, idx));

    sampleValues.push({
      close: Number(candle.close),
      date: formatDate(candle.openTimeInISO),
      deadZone: result ? result.deadZone.toFixed(4) : <NotAvailable />,
      explosion: result ? result.explosion.toFixed(4) : <NotAvailable />,
      period: idx + 1,
      signal: signal.state,
      trend: result ? result.trend.toFixed(4) : <NotAvailable />,
    });
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2 select-text">
          WAE(10, 20, BB 10, ATR 20) / Required Inputs: {wae.getRequiredInputs()}
        </h2>
        <p className="text-slate-300 select-text">{config.description}</p>
        <p className="text-slate-400 text-sm mt-2 select-text">
          Trade only on explosion: when the explosion line rises above the dead zone, the trend histogram names the
          direction — green pushes up, red pushes down. Everything below the dead zone is noise.
        </p>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
        <HighchartsChart
          options={{
            chart: {backgroundColor: 'transparent', height: 300, type: 'line'},
            credits: {enabled: false},
            legend: {enabled: true, itemStyle: {color: '#e2e8f0'}},
            plotOptions: {
              column: {borderWidth: 0},
              line: {lineWidth: 2, marker: {enabled: true, radius: 3}},
            },
            series: [
              {
                data: chartDataTrend,
                name: 'Trend',
                opacity: 0.7,
                type: 'column',
              },
              {
                color: config.color,
                data: chartDataExplosion,
                marker: {fillColor: config.color},
                name: 'Explosion',
                type: 'line',
              },
              {
                color: '#3b82f6',
                dashStyle: 'Dash',
                data: chartDataDeadZone,
                marker: {enabled: false},
                name: 'Dead Zone',
                type: 'line',
              },
            ],
            title: {
              style: {color: '#e2e8f0', fontSize: '16px', fontWeight: '600'},
              text: 'Waddah Attar Explosion (10, 20, BB 10, ATR 20)',
            },
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
              title: {style: {color: '#94a3b8'}, text: 'Value'},
            },
          }}
        />
      </div>

      <PriceChart title="Input Prices" data={priceData} />

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-3">All Sample Values</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-600">
                <th className="text-left text-slate-300 py-2 px-3">Period</th>
                <th className="text-left text-slate-300 py-2 px-3">Date</th>
                <th className="text-left text-slate-300 py-2 px-3">Close</th>
                <th className="text-left text-slate-300 py-2 px-3">Trend</th>
                <th className="text-left text-slate-300 py-2 px-3">Explosion</th>
                <th className="text-left text-slate-300 py-2 px-3">Dead Zone</th>
                <th className="text-left text-slate-300 py-2 px-3">Signal</th>
              </tr>
            </thead>
            <tbody>
              {sampleValues.map(row => (
                <tr key={row.period} className="border-b border-slate-700/50">
                  <td className="text-slate-400 py-2 px-3">{row.period}</td>
                  <td className="text-slate-300 py-2 px-3">{row.date}</td>
                  <td className="text-slate-300 py-2 px-3">${row.close.toFixed(2)}</td>
                  <td className="text-white font-mono py-2 px-3">{row.trend}</td>
                  <td className="text-white font-mono py-2 px-3">{row.explosion}</td>
                  <td className="text-white font-mono py-2 px-3">{row.deadZone}</td>
                  <td className="py-2 px-3">
                    <SignalBadge signal={row.signal} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export const WaddahAttarExplosion: IndicatorConfig = {
  color: '#a0522d',
  createIndicator: createWaddahAttarExplosion,
  customRender: renderWaddahAttarExplosion,
  description: 'Waddah Attar Explosion',
  id: 'waddah-attar',
  name: 'WAE',
  requiredInputs: 21,
  type: 'custom',
};
