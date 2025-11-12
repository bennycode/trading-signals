import {useRouter} from 'next/router';
import {useEffect, useState} from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import {
  AC,
  AO,
  CCI,
  CG,
  EMA,
  MACD,
  MOM,
  OBV,
  REI,
  ROC,
  RSI,
  StochasticOscillator,
  StochasticRSI,
  TDS,
  WilliamsR,
} from 'trading-signals';
import Chart, {ChartDataPoint} from '../../components/Chart';

interface IndicatorConfig {
  id: string;
  name: string;
  description: string;
  color: string;
  requiredInputs: number;
}

// Reusable component for rendering signal badges
const SignalBadge = ({signal}: {signal: string}) => {
  const displayText = signal === 'UNKNOWN' ? 'N/A' : signal;
  const colorClasses =
    signal === 'BULLISH' || signal === 'OVERSOLD'
      ? 'bg-green-900/50 text-green-400 border-green-800'
      : signal === 'BEARISH' || signal === 'OVERBOUGHT'
        ? 'bg-red-900/50 text-red-400 border-red-800'
        : 'bg-slate-900/50 text-slate-400 border-slate-700';

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold border ${colorClasses}`}>
      {displayText}
    </span>
  );
};

// OHLCV data (from Ethereum)
const ethCandles = [
  {date: '09/11/2025', open: 2318.45, high: 2345.67, low: 2298.12, close: 2334.89, volume: 4567890},
  {date: '09/12/2025', open: 2334.89, high: 2389.23, low: 2315.67, close: 2378.45, volume: 5234567},
  {date: '09/13/2025', open: 2378.45, high: 2398.76, low: 2356.34, close: 2367.89, volume: 4890123},
  {date: '09/14/2025', open: 2367.89, high: 2401.23, low: 2348.56, close: 2395.12, volume: 5123456},
  {date: '09/15/2025', open: 2395.12, high: 2445.67, low: 2388.9, close: 2432.56, volume: 6234567},
  {date: '09/16/2025', open: 2432.56, high: 2468.34, low: 2415.23, close: 2456.78, volume: 5890123},
  {date: '09/17/2025', open: 2456.78, high: 2489.12, low: 2441.56, close: 2478.34, volume: 5567890},
  {date: '09/18/2025', open: 2478.34, high: 2512.45, low: 2465.89, close: 2498.67, volume: 6123456},
  {date: '09/19/2025', open: 2498.67, high: 2534.23, low: 2487.56, close: 2523.45, volume: 6890123},
  {date: '09/20/2025', open: 2523.45, high: 2556.78, low: 2510.12, close: 2545.89, volume: 7234567},
  {date: '09/21/2025', open: 2545.89, high: 2578.34, low: 2532.67, close: 2567.12, volume: 6567890},
  {date: '09/22/2025', open: 2567.12, high: 2589.45, low: 2548.23, close: 2574.56, volume: 5890123},
  {date: '09/23/2025', open: 2574.56, high: 2598.67, low: 2556.78, close: 2589.34, volume: 6123456},
  {date: '09/24/2025', open: 2589.34, high: 2612.89, low: 2578.45, close: 2601.23, volume: 6456789},
  {date: '09/25/2025', open: 2601.23, high: 2634.56, low: 2587.9, close: 2623.45, volume: 7123456},
  {date: '09/26/2025', open: 2623.45, high: 2656.78, low: 2612.34, close: 2645.67, volume: 7890123},
  {date: '09/27/2025', open: 2645.67, high: 2678.9, low: 2634.23, close: 2667.89, volume: 8234567},
  {date: '09/28/2025', open: 2667.89, high: 2689.12, low: 2651.45, close: 2678.34, volume: 7567890},
  {date: '09/29/2025', open: 2678.34, high: 2698.56, low: 2665.78, close: 2689.23, volume: 6890123},
  {date: '09/30/2025', open: 2689.23, high: 2712.45, low: 2676.89, close: 2701.56, volume: 7234567},
  {date: '10/01/2025', open: 2701.56, high: 2734.67, low: 2689.34, close: 2723.45, volume: 7890123},
  {date: '10/02/2025', open: 2723.45, high: 2756.89, low: 2712.78, close: 2745.67, volume: 8567890},
  {date: '10/03/2025', open: 2745.67, high: 2778.34, low: 2734.56, close: 2767.89, volume: 9123456},
  {date: '10/04/2025', open: 2767.89, high: 2798.45, low: 2756.23, close: 2789.12, volume: 8890123},
  {date: '10/05/2025', open: 2789.12, high: 2823.56, low: 2778.67, close: 2812.34, volume: 9234567},
  {date: '10/06/2025', open: 2812.34, high: 2845.78, low: 2801.45, close: 2834.56, volume: 9567890},
  {date: '10/07/2025', open: 2834.56, high: 2867.23, low: 2823.89, close: 2856.78, volume: 10123456},
  {date: '10/08/2025', open: 2856.78, high: 2889.45, low: 2845.67, close: 2878.9, volume: 10567890},
  {date: '10/09/2025', open: 2878.9, high: 2912.34, low: 2867.56, close: 2901.23, volume: 11234567},
  {date: '10/10/2025', open: 2901.23, high: 2934.67, low: 2889.78, close: 2923.45, volume: 10890123},
  {date: '10/11/2025', open: 2923.45, high: 2956.89, low: 2912.34, close: 2945.67, volume: 11567890},
  {date: '10/12/2025', open: 2945.67, high: 2978.23, low: 2934.56, close: 2967.89, volume: 12123456},
  {date: '10/13/2025', open: 2967.89, high: 2989.45, low: 2956.78, close: 2978.34, volume: 11234567},
  {date: '10/14/2025', open: 2978.34, high: 3012.56, low: 2967.9, close: 3001.23, volume: 12890123},
  {date: '10/15/2025', open: 3001.23, high: 3034.78, low: 2989.67, close: 3023.45, volume: 13567890},
  {date: '10/16/2025', open: 3023.45, high: 3056.34, low: 3012.89, close: 3045.67, volume: 14123456},
  {date: '10/17/2025', open: 3045.67, high: 3078.9, low: 3034.56, close: 3067.89, volume: 13890123},
  {date: '10/18/2025', open: 3067.89, high: 3089.23, low: 3056.78, close: 3078.45, volume: 12567890},
  {date: '10/19/2025', open: 3078.45, high: 3098.67, low: 3067.34, close: 3089.56, volume: 11890123},
  {date: '10/20/2025', open: 3089.56, high: 3112.34, low: 3078.9, close: 3101.23, volume: 12234567},
];

const indicators: IndicatorConfig[] = [
  {
    id: 'rsi',
    name: 'RSI',
    description: 'Relative Strength Index',
    color: '#8b5cf6',
    requiredInputs: new RSI(14).getRequiredInputs(),
  },
  {
    id: 'stoch',
    name: 'Stochastic',
    description: 'Stochastic Oscillator',
    color: '#ec4899',
    requiredInputs: new StochasticOscillator(14, 3, 3).getRequiredInputs(),
  },
  {
    id: 'cci',
    name: 'CCI',
    description: 'Commodity Channel Index',
    color: '#f59e0b',
    requiredInputs: new CCI(20).getRequiredInputs(),
  },
  {
    id: 'roc',
    name: 'ROC',
    description: 'Rate of Change',
    color: '#10b981',
    requiredInputs: new ROC(9).getRequiredInputs(),
  },
  {
    id: 'macd',
    name: 'MACD',
    description: 'Moving Average Convergence Divergence',
    color: '#3b82f6',
    requiredInputs: new MACD(new EMA(12), new EMA(26), new EMA(9)).getRequiredInputs(),
  },
  {
    id: 'ao',
    name: 'AO',
    description: 'Awesome Oscillator',
    color: '#06b6d4',
    requiredInputs: new AO(5, 34).getRequiredInputs(),
  },
  {
    id: 'ac',
    name: 'AC',
    description: 'Accelerator Oscillator',
    color: '#6366f1',
    requiredInputs: new AC(5, 34, 5).getRequiredInputs(),
  },
  {
    id: 'cg',
    name: 'CG',
    description: 'Center of Gravity',
    color: '#f97316',
    requiredInputs: new CG(10, 10).getRequiredInputs(),
  },
  {id: 'mom', name: 'MOM', description: 'Momentum', color: '#84cc16', requiredInputs: new MOM(5).getRequiredInputs()},
  {
    id: 'obv',
    name: 'OBV',
    description: 'On-Balance Volume',
    color: '#14b8a6',
    requiredInputs: new OBV(5).getRequiredInputs(),
  },
  {
    id: 'rei',
    name: 'REI',
    description: 'Range Expansion Index',
    color: '#a855f7',
    requiredInputs: new REI(5).getRequiredInputs(),
  },
  {
    id: 'stochrsi',
    name: 'StochRSI',
    description: 'Stochastic RSI',
    color: '#ef4444',
    requiredInputs: new StochasticRSI(14).getRequiredInputs(),
  },
  {
    id: 'tds',
    name: 'TDS',
    description: 'Tom DeMark Sequential',
    color: '#ec4899',
    requiredInputs: new TDS().getRequiredInputs(),
  },
  {
    id: 'willr',
    name: 'Williams %R',
    description: 'Williams Percent Range',
    color: '#22d3ee',
    requiredInputs: new WilliamsR(14).getRequiredInputs(),
  },
];

export default function MomentumIndicators() {
  const router = useRouter();
  const [selectedIndicator, setSelectedIndicator] = useState<string>('rsi');

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash && indicators.some(ind => ind.id === hash)) {
      setSelectedIndicator(hash);
    }
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (hash && indicators.some(ind => ind.id === hash)) {
        setSelectedIndicator(hash);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleIndicatorChange = (indicatorId: string) => {
    setSelectedIndicator(indicatorId);
    window.location.hash = indicatorId;
  };

  const renderIndicatorContent = () => {
    const config = indicators.find(ind => ind.id === selectedIndicator);
    if (!config) return null;

    switch (selectedIndicator) {
      case 'rsi':
        return renderRSI(config);
      case 'stoch':
        return renderStochastic(config);
      case 'cci':
        return renderCCI(config);
      case 'roc':
        return renderROC(config);
      case 'macd':
        return renderMACD(config);
      case 'ao':
        return renderAO(config);
      case 'ac':
        return renderAC(config);
      case 'cg':
        return renderCG(config);
      case 'mom':
        return renderMOM(config);
      case 'obv':
        return renderOBV(config);
      case 'rei':
        return renderREI(config);
      case 'stochrsi':
        return renderStochRSI(config);
      case 'tds':
        return renderTDS(config);
      case 'willr':
        return renderWilliamsR(config);
      default:
        return null;
    }
  };

  const renderRSI = (config: IndicatorConfig) => {
    const rsi = new RSI(14);
    const chartData: ChartDataPoint[] = [];
    const sampleValues: Array<{period: number; date: string; close: number; result: string; signal: string}> = [];

    ethCandles.forEach((candle, idx) => {
      rsi.add(candle.close);
      const result = rsi.isStable ? rsi.getResult() : null;
      const signal = rsi.getSignal();
      chartData.push({x: idx + 1, y: result});

      sampleValues.push({
        period: idx + 1,
        date: candle.date,
        close: candle.close,
        result: result !== null ? result.toFixed(2) : 'N/A',
        signal: signal.state,
      });
    });

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2 select-text">
            RSI(14) / Required Inputs: {rsi.getRequiredInputs()}
          </h2>
          <p className="text-slate-300 select-text">{config.description}</p>
          <p className="text-slate-400 text-sm mt-2 select-text">
            RSI measures the magnitude of recent price changes to evaluate overbought or oversold conditions. Values
            above 70 indicate overbought, below 30 indicate oversold.
          </p>
        </div>

        <Chart title="RSI (14)" data={chartData} yAxisLabel="RSI" color={config.color} />

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-3">All Sample Values</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-600">
                  <th className="text-left text-slate-300 py-2 px-3">Period</th>
                  <th className="text-left text-slate-300 py-2 px-3">Date</th>
                  <th className="text-left text-slate-300 py-2 px-3">Close</th>
                  <th className="text-left text-slate-300 py-2 px-3">RSI</th>
                  <th className="text-left text-slate-300 py-2 px-3">Signal</th>
                </tr>
              </thead>
              <tbody>
                {sampleValues.map(row => (
                  <tr key={row.period} className="border-b border-slate-700/50">
                    <td className="text-slate-400 py-2 px-3">{row.period}</td>
                    <td className="text-slate-400 py-2 px-3">{row.date}</td>
                    <td className="text-slate-300 py-2 px-3">${row.close.toFixed(2)}</td>
                    <td className="text-white font-mono py-2 px-3">{row.result}</td>
                    <td className="py-2 px-3">
                      <SignalBadge signal={row.signal} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-purple-900/20 border border-purple-800/50 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-purple-400 mb-2">Code Example</h3>
          <pre className="text-slate-300 text-sm overflow-x-auto">
            <code>{`import { RSI } from 'trading-signals';

const rsi = new RSI(14);

// Add price values
rsi.add(44);
rsi.add(45);
rsi.add(46);
// ... add more values

if (rsi.isStable) {
  console.log('RSI:', rsi.getResultOrThrow().toFixed(2));
}`}</code>
          </pre>
        </div>
      </div>
    );
  };

  const renderStochastic = (config: IndicatorConfig) => {
    const stoch = new StochasticOscillator(14, 3, 3);
    const chartDataK: ChartDataPoint[] = [];
    const chartDataD: ChartDataPoint[] = [];
    const sampleValues: Array<{period: number; date: string; close: number; k: string; d: string; signal: string}> = [];

    ethCandles.forEach((candle, idx) => {
      stoch.add({high: candle.high, low: candle.low, close: candle.close});
      const result = stoch.isStable ? stoch.getResult() : null;
      const signal = stoch.getSignal();
      chartDataK.push({x: idx + 1, y: result?.stochK ?? null});
      chartDataD.push({x: idx + 1, y: result?.stochD ?? null});

      sampleValues.push({
        period: idx + 1,
        date: candle.date,
        close: candle.close,
        k: result ? result.stochK.toFixed(2) : 'N/A',
        d: result ? result.stochD.toFixed(2) : 'N/A',
        signal: signal.state,
      });
    });

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2 select-text">
            StochasticOscillator(14, 3, 3) / Required Inputs: {stoch.getRequiredInputs()}
          </h2>
          <p className="text-slate-300 select-text">{config.description}</p>
          <p className="text-slate-400 text-sm mt-2 select-text">
            Compares closing price to price range over a period. %K crossing above %D can signal a buying opportunity.
          </p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <HighchartsReact
            highcharts={Highcharts}
            options={{
              chart: {
                type: 'line',
                backgroundColor: 'transparent',
                height: 300,
              },
              title: {
                text: 'Stochastic Oscillator (14,3,3)',
                style: {
                  color: '#e2e8f0',
                  fontSize: '16px',
                  fontWeight: '600',
                },
              },
              credits: {
                enabled: false,
              },
              xAxis: {
                title: {
                  text: 'Period',
                  style: {color: '#94a3b8'},
                },
                labels: {
                  style: {color: '#94a3b8'},
                },
                gridLineColor: '#334155',
              },
              yAxis: {
                title: {
                  text: 'Value',
                  style: {color: '#94a3b8'},
                },
                labels: {
                  style: {color: '#94a3b8'},
                },
                gridLineColor: '#334155',
              },
              legend: {
                enabled: true,
                itemStyle: {
                  color: '#e2e8f0',
                },
              },
              plotOptions: {
                line: {
                  marker: {
                    enabled: true,
                    radius: 3,
                  },
                  lineWidth: 2,
                },
              },
              series: [
                {
                  type: 'line',
                  name: '%K',
                  data: chartDataK.map(point => [point.x, point.y]),
                  color: config.color,
                  marker: {
                    fillColor: config.color,
                  },
                },
                {
                  type: 'line',
                  name: '%D',
                  data: chartDataD.map(point => [point.x, point.y]),
                  color: '#f97316',
                  marker: {
                    fillColor: '#f97316',
                  },
                },
              ],
              tooltip: {
                backgroundColor: '#1e293b',
                borderColor: '#475569',
                style: {
                  color: '#e2e8f0',
                },
                shared: true,
                formatter: function (): string {
                  let s: string = `<b>Period ${(this as any).x}</b><br/>`;
                  ((this as any).points as any[])?.forEach((point: any) => {
                    const yValue = typeof point.y === 'number' ? point.y.toFixed(2) : 'N/A';
                    s += `${point.series.name}: ${yValue}<br/>`;
                  });
                  return s;
                },
              },
            }}
          />
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-3">All Sample Values</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-600">
                  <th className="text-left text-slate-300 py-2 px-3">Period</th>
                  <th className="text-left text-slate-300 py-2 px-3">Date</th>
                  <th className="text-left text-slate-300 py-2 px-3">Close</th>
                  <th className="text-left text-slate-300 py-2 px-3">%K</th>
                  <th className="text-left text-slate-300 py-2 px-3">%D</th>
                  <th className="text-left text-slate-300 py-2 px-3">Signal</th>
                </tr>
              </thead>
              <tbody>
                {sampleValues.map(row => (
                  <tr key={row.period} className="border-b border-slate-700/50">
                    <td className="text-slate-400 py-2 px-3">{row.period}</td>
                    <td className="text-slate-400 py-2 px-3">{row.date}</td>
                    <td className="text-slate-300 py-2 px-3">${row.close.toFixed(2)}</td>
                    <td className="text-white font-mono py-2 px-3">{row.k}</td>
                    <td className="text-white font-mono py-2 px-3">{row.d}</td>
                    <td className="py-2 px-3">
                      <SignalBadge signal={row.signal} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-purple-900/20 border border-purple-800/50 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-purple-400 mb-2">Code Example</h3>
          <pre className="text-slate-300 text-sm overflow-x-auto">
            <code>{`import { StochasticOscillator } from 'trading-signals';

const stoch = new StochasticOscillator(14, 3, 3);

stoch.add({
  high: 50,
  low: 40,
  close: 45
});

if (stoch.isStable) {
  const result = stoch.getResultOrThrow();
  console.log('%K:', result.stochK.toFixed(2));
  console.log('%D:', result.stochD.toFixed(2));
}`}</code>
          </pre>
        </div>
      </div>
    );
  };

  const renderCCI = (config: IndicatorConfig) => {
    const cci = new CCI(20);
    const chartData: ChartDataPoint[] = [];
    const sampleValues: Array<{period: number; date: string; close: number; result: string; signal: string}> = [];

    ethCandles.forEach((candle, idx) => {
      cci.add({high: candle.high, low: candle.low, close: candle.close});
      const result = cci.isStable ? cci.getResult() : null;
      const signal = cci.getSignal();
      chartData.push({x: idx + 1, y: result});

      sampleValues.push({
        period: idx + 1,
        date: candle.date,
        close: candle.close,
        result: result !== null ? result.toFixed(2) : 'N/A',
        signal: signal.state,
      });
    });

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2 select-text">
            CCI(20) / Required Inputs: {cci.getRequiredInputs()}
          </h2>
          <p className="text-slate-300 select-text">{config.description}</p>
          <p className="text-slate-400 text-sm mt-2 select-text">
            Measures deviation from the average price. Readings above +100 suggest overbought, below -100 suggest
            oversold.
          </p>
        </div>

        <Chart title="CCI (20)" data={chartData} yAxisLabel="CCI" color={config.color} />

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-3">All Sample Values</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-600">
                  <th className="text-left text-slate-300 py-2 px-3">Period</th>
                  <th className="text-left text-slate-300 py-2 px-3">Date</th>
                  <th className="text-left text-slate-300 py-2 px-3">Close</th>
                  <th className="text-left text-slate-300 py-2 px-3">CCI</th>
                  <th className="text-left text-slate-300 py-2 px-3">Signal</th>
                </tr>
              </thead>
              <tbody>
                {sampleValues.map(row => (
                  <tr key={row.period} className="border-b border-slate-700/50">
                    <td className="text-slate-400 py-2 px-3">{row.period}</td>
                    <td className="text-slate-400 py-2 px-3">{row.date}</td>
                    <td className="text-slate-300 py-2 px-3">${row.close.toFixed(2)}</td>
                    <td className="text-white font-mono py-2 px-3">{row.result}</td>
                    <td className="py-2 px-3">
                      <SignalBadge signal={row.signal} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-purple-900/20 border border-purple-800/50 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-purple-400 mb-2">Code Example</h3>
          <pre className="text-slate-300 text-sm overflow-x-auto">
            <code>{`import { CCI } from 'trading-signals';

const cci = new CCI(20);

cci.add({
  high: 52,
  low: 48,
  close: 50
});

if (cci.isStable) {
  console.log('CCI:', cci.getResultOrThrow().toFixed(2));
}`}</code>
          </pre>
        </div>
      </div>
    );
  };

  const renderROC = (config: IndicatorConfig) => {
    const prices = [100, 102, 105, 107, 110, 108, 106, 109, 112, 115, 117, 119, 120];
    const roc = new ROC(9);
    const chartData: ChartDataPoint[] = [];
    const sampleValues: Array<{period: number; date: string; close: number; result: string; signal: string}> = [];

    ethCandles.forEach((candle, idx) => {
      roc.add(candle.close);
      const result = roc.isStable ? roc.getResult() : null;
      const signal = roc.getSignal();
      chartData.push({x: idx + 1, y: result});

      sampleValues.push({
        period: idx + 1,
        date: candle.date,
        close: candle.close,
        result: result !== null ? result.toFixed(2) : 'N/A',
        signal: signal.state,
      });
    });

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2 select-text">
            ROC(9) / Required Inputs: {roc.getRequiredInputs()}
          </h2>
          <p className="text-slate-300 select-text">{config.description}</p>
          <p className="text-slate-400 text-sm mt-2 select-text">
            Measures the percentage change in price from n periods ago. Positive values indicate upward momentum,
            negative values indicate downward momentum.
          </p>
        </div>

        <Chart title="ROC (9)" data={chartData} yAxisLabel="ROC %" color={config.color} />

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-3">All Sample Values</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-600">
                  <th className="text-left text-slate-300 py-2 px-3">Period</th>
                  <th className="text-left text-slate-300 py-2 px-3">Date</th>
                  <th className="text-left text-slate-300 py-2 px-3">Close</th>
                  <th className="text-left text-slate-300 py-2 px-3">ROC %</th>
                  <th className="text-left text-slate-300 py-2 px-3">Signal</th>
                </tr>
              </thead>
              <tbody>
                {sampleValues.map(row => (
                  <tr key={row.period} className="border-b border-slate-700/50">
                    <td className="text-slate-400 py-2 px-3">{row.period}</td>
                    <td className="text-slate-300 py-2 px-3">{row.date}</td>
                    <td className="text-slate-300 py-2 px-3">${row.close.toFixed(2)}</td>
                    <td className="text-white font-mono py-2 px-3">{row.result}</td>
                    <td className="py-2 px-3">
                      <SignalBadge signal={row.signal} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-purple-900/20 border border-purple-800/50 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-purple-400 mb-2">Code Example</h3>
          <pre className="text-slate-300 text-sm overflow-x-auto">
            <code>{`import { ROC } from 'trading-signals';

const roc = new ROC(9);

roc.add(100);
roc.add(102);
roc.add(105);

if (roc.isStable) {
  console.log('ROC %:', roc.getResultOrThrow().toFixed(2));
}`}</code>
          </pre>
        </div>
      </div>
    );
  };

  const renderMACD = (config: IndicatorConfig) => {
    const macd = new MACD(new EMA(12), new EMA(26), new EMA(9));
    const chartDataMACD: ChartDataPoint[] = [];
    const chartDataSignal: ChartDataPoint[] = [];
    const chartDataHistogram: ChartDataPoint[] = [];
    const sampleValues: Array<{period: number; date: string; close: number; result: string; signal: string}> = [];

    ethCandles.forEach((candle, idx) => {
      macd.add(candle.close);
      const result = macd.isStable ? macd.getResult() : null;
      chartDataMACD.push({x: idx + 1, y: result?.macd ?? null});
      chartDataSignal.push({x: idx + 1, y: result?.signal ?? null});
      chartDataHistogram.push({x: idx + 1, y: result?.histogram ?? null});

      sampleValues.push({
        period: idx + 1,
        date: candle.date,
        close: candle.close,
        result: result ? `${result.macd.toFixed(4)}` : 'N/A',
        signal: 'N/A',
      });
    });

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2 select-text">
            MACD(12, 26, 9) / Required Inputs: {macd.getRequiredInputs()}
          </h2>
          <p className="text-slate-300 select-text">{config.description}</p>
          <p className="text-slate-400 text-sm mt-2 select-text">
            Shows relationship between two moving averages. Crossing above signal line = bullish, crossing below =
            bearish.
          </p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <HighchartsReact
            highcharts={Highcharts}
            options={{
              chart: {
                type: 'line',
                backgroundColor: 'transparent',
                height: 300,
              },
              title: {
                text: 'MACD (12,26,9)',
                style: {
                  color: '#e2e8f0',
                  fontSize: '16px',
                  fontWeight: '600',
                },
              },
              credits: {
                enabled: false,
              },
              xAxis: {
                title: {
                  text: 'Period',
                  style: {color: '#94a3b8'},
                },
                labels: {
                  style: {color: '#94a3b8'},
                },
                gridLineColor: '#334155',
              },
              yAxis: {
                title: {
                  text: 'Value',
                  style: {color: '#94a3b8'},
                },
                labels: {
                  style: {color: '#94a3b8'},
                },
                gridLineColor: '#334155',
              },
              legend: {
                enabled: true,
                itemStyle: {
                  color: '#e2e8f0',
                },
              },
              plotOptions: {
                line: {
                  marker: {
                    enabled: true,
                    radius: 3,
                  },
                  lineWidth: 2,
                },
                column: {
                  borderWidth: 0,
                },
              },
              series: [
                {
                  type: 'line',
                  name: 'MACD',
                  data: chartDataMACD.map(point => [point.x, point.y]),
                  color: config.color,
                  marker: {
                    fillColor: config.color,
                  },
                },
                {
                  type: 'line',
                  name: 'Signal',
                  data: chartDataSignal.map(point => [point.x, point.y]),
                  color: '#f97316',
                  marker: {
                    fillColor: '#f97316',
                  },
                },
                {
                  type: 'column',
                  name: 'Histogram',
                  data: chartDataHistogram.map(point => [point.x, point.y]),
                  color: '#6366f1',
                  opacity: 0.5,
                },
              ],
              tooltip: {
                backgroundColor: '#1e293b',
                borderColor: '#475569',
                style: {
                  color: '#e2e8f0',
                },
                shared: true,
                formatter: function (): string {
                  let s: string = `<b>Period ${(this as any).x}</b><br/>`;
                  ((this as any).points as any[])?.forEach((point: any) => {
                    const yValue = typeof point.y === 'number' ? point.y.toFixed(4) : 'N/A';
                    s += `${point.series.name}: ${yValue}<br/>`;
                  });
                  return s;
                },
              },
            }}
          />
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-3">All Sample Values</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-600">
                  <th className="text-left text-slate-300 py-2 px-3">Period</th>
                  <th className="text-left text-slate-300 py-2 px-3">Date</th>
                  <th className="text-left text-slate-300 py-2 px-3">Close</th>
                  <th className="text-left text-slate-300 py-2 px-3">MACD</th>
                  <th className="text-left text-slate-300 py-2 px-3">Signal</th>
                </tr>
              </thead>
              <tbody>
                {sampleValues.map(row => (
                  <tr key={row.period} className="border-b border-slate-700/50">
                    <td className="text-slate-400 py-2 px-3">{row.period}</td>
                    <td className="text-slate-300 py-2 px-3">{row.date}</td>
                    <td className="text-slate-300 py-2 px-3">${row.close.toFixed(2)}</td>
                    <td className="text-white font-mono py-2 px-3">{row.result}</td>
                    <td className="py-2 px-3">
                      <SignalBadge signal={row.signal} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-purple-900/20 border border-purple-800/50 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-purple-400 mb-2">Code Example</h3>
          <pre className="text-slate-300 text-sm overflow-x-auto">
            <code>{`import { MACD, EMA } from 'trading-signals';

const macd = new MACD(new EMA(12), new EMA(26), new EMA(9));

macd.add(12);
macd.add(12.5);
// ... add more values

if (macd.isStable) {
  const result = macd.getResultOrThrow();
  console.log('MACD:', result.macd.toFixed(4));
  console.log('Signal:', result.signal.toFixed(4));
  console.log('Histogram:', result.histogram.toFixed(4));
}`}</code>
          </pre>
        </div>
      </div>
    );
  };

  const renderAO = (config: IndicatorConfig) => {
    const ao = new AO(5, 34);
    const chartData: ChartDataPoint[] = [];
    const sampleValues: Array<{
      period: number;
      date: string;
      high: number;
      low: number;
      result: string;
      signal: string;
    }> = [];

    ethCandles.forEach((candle, idx) => {
      ao.add(candle);
      const result = ao.isStable ? ao.getResult() : null;
      const signal = ao.getSignal();
      chartData.push({x: idx + 1, y: result});

      sampleValues.push({
        period: idx + 1,
        date: candle.date,
        high: candle.high,
        low: candle.low,
        result: result !== null ? result.toFixed(2) : 'N/A',
        signal: signal.state,
      });
    });

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2 select-text">
            AO(5, 34) / Required Inputs: {ao.getRequiredInputs()}
          </h2>
          <p className="text-slate-300 select-text">{config.description}</p>
          <p className="text-slate-400 text-sm mt-2 select-text">
            Measures market momentum using the difference between a 5-period and 34-period simple moving average of the
            bar's midpoints.
          </p>
        </div>

        <Chart title="Awesome Oscillator (5,34)" data={chartData} yAxisLabel="AO" color={config.color} />

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-3">All Sample Values</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-600">
                  <th className="text-left text-slate-300 py-2 px-3">Period</th>
                  <th className="text-left text-slate-300 py-2 px-3">Date</th>
                  <th className="text-left text-slate-300 py-2 px-3">High</th>
                  <th className="text-left text-slate-300 py-2 px-3">Low</th>
                  <th className="text-left text-slate-300 py-2 px-3">AO</th>
                  <th className="text-left text-slate-300 py-2 px-3">Signal</th>
                </tr>
              </thead>
              <tbody>
                {sampleValues.map(row => (
                  <tr key={row.period} className="border-b border-slate-700/50">
                    <td className="text-slate-400 py-2 px-3">{row.period}</td>
                    <td className="text-slate-300 py-2 px-3">{row.date}</td>
                    <td className="text-slate-300 py-2 px-3">${row.high.toFixed(2)}</td>
                    <td className="text-slate-300 py-2 px-3">${row.low.toFixed(2)}</td>
                    <td className="text-white font-mono py-2 px-3">{row.result}</td>
                    <td className="py-2 px-3">
                      <SignalBadge signal={row.signal} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-purple-900/20 border border-purple-800/50 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-purple-400 mb-2">Code Example</h3>
          <pre className="text-slate-300 text-sm overflow-x-auto">
            <code>{`import { AO } from 'trading-signals';

const ao = new AO(5, 34);

ao.add({ high: 105, low: 95 });
ao.add({ high: 107, low: 97 });

if (ao.isStable) {
  console.log('AO:', ao.getResultOrThrow().toFixed(2));
}`}</code>
          </pre>
        </div>
      </div>
    );
  };

  const renderAC = (config: IndicatorConfig) => {
    const ac = new AC(5, 34, 5);
    const chartData: ChartDataPoint[] = [];
    const sampleValues: Array<{
      period: number;
      date: string;
      high: number;
      low: number;
      result: string;
      signal: string;
    }> = [];

    ethCandles.forEach((candle, idx) => {
      ac.add(candle);
      const result = ac.isStable ? ac.getResult() : null;
      const signal = ac.getSignal();
      chartData.push({x: idx + 1, y: result});

      sampleValues.push({
        period: idx + 1,
        date: candle.date,
        high: candle.high,
        low: candle.low,
        result: result !== null ? result.toFixed(2) : 'N/A',
        signal: signal.state,
      });
    });

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2 select-text">
            AC(5, 34, 5) / Required Inputs: {ac.getRequiredInputs()}
          </h2>
          <p className="text-slate-300 select-text">{config.description}</p>
          <p className="text-slate-400 text-sm mt-2 select-text">
            Shows acceleration or deceleration of the current driving force. Earlier signal of potential trend change
            than AO.
          </p>
        </div>

        <Chart title="Accelerator Oscillator (5,34,5)" data={chartData} yAxisLabel="AC" color={config.color} />

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-3">All Sample Values</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-600">
                  <th className="text-left text-slate-300 py-2 px-3">Period</th>
                  <th className="text-left text-slate-300 py-2 px-3">Date</th>
                  <th className="text-left text-slate-300 py-2 px-3">High</th>
                  <th className="text-left text-slate-300 py-2 px-3">Low</th>
                  <th className="text-left text-slate-300 py-2 px-3">AC</th>
                  <th className="text-left text-slate-300 py-2 px-3">Signal</th>
                </tr>
              </thead>
              <tbody>
                {sampleValues.map(row => (
                  <tr key={row.period} className="border-b border-slate-700/50">
                    <td className="text-slate-400 py-2 px-3">{row.period}</td>
                    <td className="text-slate-300 py-2 px-3">{row.date}</td>
                    <td className="text-slate-300 py-2 px-3">${row.high.toFixed(2)}</td>
                    <td className="text-slate-300 py-2 px-3">${row.low.toFixed(2)}</td>
                    <td className="text-white font-mono py-2 px-3">{row.result}</td>
                    <td className="py-2 px-3">
                      <SignalBadge signal={row.signal} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-purple-900/20 border border-purple-800/50 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-purple-400 mb-2">Code Example</h3>
          <pre className="text-slate-300 text-sm overflow-x-auto">
            <code>{`import { AC } from 'trading-signals';

const ac = new AC(5, 34, 5);

ac.add({ high: 105, low: 95 });
ac.add({ high: 107, low: 97 });

if (ac.isStable) {
  console.log('AC:', ac.getResultOrThrow().toFixed(2));
}`}</code>
          </pre>
        </div>
      </div>
    );
  };

  const renderCG = (config: IndicatorConfig) => {
    const cg = new CG(10, 10);
    const chartData: ChartDataPoint[] = [];
    const sampleValues: Array<{period: number; date: string; close: number; result: string}> = [];

    ethCandles.forEach((candle, idx) => {
      cg.add(candle.close);
      const result = cg.isStable ? cg.getResult() : null;
      chartData.push({x: idx + 1, y: result});

      sampleValues.push({
        period: idx + 1,
        date: candle.date,
        close: candle.close,
        result: result !== null ? result.toFixed(2) : 'N/A',
      });
    });

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2 select-text">
            CG(10, 10) / Required Inputs: {cg.getRequiredInputs()}
          </h2>
          <p className="text-slate-300 select-text">{config.description}</p>
          <p className="text-slate-400 text-sm mt-2 select-text">
            Identifies turning points with minimal lag. Oscillates around zero line.
          </p>
        </div>

        <Chart title="Center of Gravity (10,10)" data={chartData} yAxisLabel="CG" color={config.color} />

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-3">All Sample Values</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-600">
                  <th className="text-left text-slate-300 py-2 px-3">Period</th>
                  <th className="text-left text-slate-300 py-2 px-3">Date</th>
                  <th className="text-left text-slate-300 py-2 px-3">Close</th>
                  <th className="text-left text-slate-300 py-2 px-3">CG</th>
                </tr>
              </thead>
              <tbody>
                {sampleValues.map(row => (
                  <tr key={row.period} className="border-b border-slate-700/50">
                    <td className="text-slate-400 py-2 px-3">{row.period}</td>
                    <td className="text-slate-300 py-2 px-3">{row.date}</td>
                    <td className="text-slate-300 py-2 px-3">${row.close.toFixed(2)}</td>
                    <td className="text-white font-mono py-2 px-3">{row.result}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-purple-900/20 border border-purple-800/50 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-purple-400 mb-2">Code Example</h3>
          <pre className="text-slate-300 text-sm overflow-x-auto">
            <code>{`import { CG } from 'trading-signals';

const cg = new CG(10, 10);

cg.add(10);
cg.add(11);
cg.add(12);

if (cg.isStable) {
  console.log('CG:', cg.getResultOrThrow().toFixed(2));
}`}</code>
          </pre>
        </div>
      </div>
    );
  };

  const renderMOM = (config: IndicatorConfig) => {
    const mom = new MOM(5);
    const chartData: ChartDataPoint[] = [];
    const sampleValues: Array<{period: number; date: string; close: number; result: string}> = [];

    ethCandles.forEach((candle, idx) => {
      mom.add(candle.close);
      const result = mom.isStable ? mom.getResult() : null;
      chartData.push({x: idx + 1, y: result});

      sampleValues.push({
        period: idx + 1,
        date: candle.date,
        close: candle.close,
        result: result !== null ? result.toFixed(2) : 'N/A',
      });
    });

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2 select-text">
            MOM(5) / Required Inputs: {mom.getRequiredInputs()}
          </h2>
          <p className="text-slate-300 select-text">{config.description}</p>
          <p className="text-slate-400 text-sm mt-2 select-text">
            Simple momentum calculation: current price minus price n periods ago.
          </p>
        </div>

        <Chart title="Momentum (5)" data={chartData} yAxisLabel="MOM" color={config.color} />

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-3">All Sample Values</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-600">
                  <th className="text-left text-slate-300 py-2 px-3">Period</th>
                  <th className="text-left text-slate-300 py-2 px-3">Date</th>
                  <th className="text-left text-slate-300 py-2 px-3">Close</th>
                  <th className="text-left text-slate-300 py-2 px-3">MOM</th>
                </tr>
              </thead>
              <tbody>
                {sampleValues.map(row => (
                  <tr key={row.period} className="border-b border-slate-700/50">
                    <td className="text-slate-400 py-2 px-3">{row.period}</td>
                    <td className="text-slate-300 py-2 px-3">{row.date}</td>
                    <td className="text-slate-300 py-2 px-3">${row.close.toFixed(2)}</td>
                    <td className="text-white font-mono py-2 px-3">{row.result}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-purple-900/20 border border-purple-800/50 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-purple-400 mb-2">Code Example</h3>
          <pre className="text-slate-300 text-sm overflow-x-auto">
            <code>{`import { MOM } from 'trading-signals';

const mom = new MOM(5);

mom.add(100);
mom.add(102);
mom.add(105);

if (mom.isStable) {
  console.log('MOM:', mom.getResultOrThrow().toFixed(2));
}`}</code>
          </pre>
        </div>
      </div>
    );
  };

  const renderOBV = (config: IndicatorConfig) => {
    const obv = new OBV(5);
    const chartData: ChartDataPoint[] = [];
    const sampleValues: Array<{
      period: number;
      date: string;
      close: number;
      volume: number;
      result: string;
      signal: string;
    }> = [];

    ethCandles.forEach((candle, idx) => {
      obv.add(candle);
      const result = obv.getResult();
      const signal = obv.getSignal();
      chartData.push({x: idx + 1, y: result});

      sampleValues.push({
        period: idx + 1,
        date: candle.date,
        close: candle.close,
        volume: candle.volume,
        result: result !== null ? result.toFixed(0) : 'N/A',
        signal: signal.state,
      });
    });

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2 select-text">
            OBV(5) / Required Inputs: {obv.getRequiredInputs()}
          </h2>
          <p className="text-slate-300 select-text">{config.description}</p>
          <p className="text-slate-400 text-sm mt-2 select-text">
            Cumulative volume-based indicator. Rising OBV with rising prices confirms uptrend.
          </p>
        </div>

        <Chart title="On-Balance Volume (5)" data={chartData} yAxisLabel="OBV" color={config.color} />

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-3">All Sample Values</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-600">
                  <th className="text-left text-slate-300 py-2 px-3">Period</th>
                  <th className="text-left text-slate-300 py-2 px-3">Date</th>
                  <th className="text-left text-slate-300 py-2 px-3">Close</th>
                  <th className="text-left text-slate-300 py-2 px-3">Volume</th>
                  <th className="text-left text-slate-300 py-2 px-3">OBV</th>
                  <th className="text-left text-slate-300 py-2 px-3">Signal</th>
                </tr>
              </thead>
              <tbody>
                {sampleValues.map(row => (
                  <tr key={row.period} className="border-b border-slate-700/50">
                    <td className="text-slate-400 py-2 px-3">{row.period}</td>
                    <td className="text-slate-300 py-2 px-3">{row.date}</td>
                    <td className="text-slate-300 py-2 px-3">${row.close.toFixed(2)}</td>
                    <td className="text-slate-300 py-2 px-3">{row.volume}</td>
                    <td className="text-white font-mono py-2 px-3">{row.result}</td>
                    <td className="py-2 px-3">
                      <SignalBadge signal={row.signal} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-purple-900/20 border border-purple-800/50 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-purple-400 mb-2">Code Example</h3>
          <pre className="text-slate-300 text-sm overflow-x-auto">
            <code>{`import { OBV } from 'trading-signals';

const obv = new OBV(5);

obv.add({ open: 100, high: 101, low: 99, close: 100, volume: 1000 });
obv.add({ open: 100, high: 103, low: 100, close: 102, volume: 1200 });

const result = obv.getResult();
if (result !== null) {
  console.log('OBV:', result.toFixed(0));
}`}</code>
          </pre>
        </div>
      </div>
    );
  };

  const renderREI = (config: IndicatorConfig) => {
    const rei = new REI(5);
    const chartData: ChartDataPoint[] = [];
    const sampleValues: Array<{period: number; date: string; close: number; result: string; signal: string}> = [];

    ethCandles.forEach((candle, idx) => {
      rei.add(candle);
      const result = rei.isStable ? rei.getResult() : null;
      const signal = rei.getSignal();
      chartData.push({x: idx + 1, y: result});

      sampleValues.push({
        period: idx + 1,
        date: candle.date,
        close: candle.close,
        result: result !== null ? result.toFixed(2) : 'N/A',
        signal: signal.state,
      });
    });

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2 select-text">
            REI(5) / Required Inputs: {rei.getRequiredInputs()}
          </h2>
          <p className="text-slate-300 select-text">{config.description}</p>
          <p className="text-slate-400 text-sm mt-2 select-text">
            Measures range expansion to identify potential breakouts.
          </p>
        </div>

        <Chart title="Range Expansion Index (5)" data={chartData} yAxisLabel="REI" color={config.color} />

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-3">All Sample Values</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-600">
                  <th className="text-left text-slate-300 py-2 px-3">Period</th>
                  <th className="text-left text-slate-300 py-2 px-3">Date</th>
                  <th className="text-left text-slate-300 py-2 px-3">Close</th>
                  <th className="text-left text-slate-300 py-2 px-3">REI</th>
                  <th className="text-left text-slate-300 py-2 px-3">Signal</th>
                </tr>
              </thead>
              <tbody>
                {sampleValues.map(row => (
                  <tr key={row.period} className="border-b border-slate-700/50">
                    <td className="text-slate-400 py-2 px-3">{row.period}</td>
                    <td className="text-slate-300 py-2 px-3">{row.date}</td>
                    <td className="text-slate-300 py-2 px-3">${row.close.toFixed(2)}</td>
                    <td className="text-white font-mono py-2 px-3">{row.result}</td>
                    <td className="py-2 px-3">
                      <SignalBadge signal={row.signal} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-purple-900/20 border border-purple-800/50 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-purple-400 mb-2">Code Example</h3>
          <pre className="text-slate-300 text-sm overflow-x-auto">
            <code>{`import { REI } from 'trading-signals';

const rei = new REI(8);

rei.add({ high: 105, low: 95, close: 100 });
rei.add({ high: 107, low: 97, close: 102 });

if (rei.isStable) {
  console.log('REI:', rei.getResultOrThrow().toFixed(2));
}`}</code>
          </pre>
        </div>
      </div>
    );
  };

  const renderStochRSI = (config: IndicatorConfig) => {
    const stochRsi = new StochasticRSI(14);
    const chartData: ChartDataPoint[] = [];
    const sampleValues: Array<{period: number; date: string; close: number; result: string; signal: string}> = [];

    ethCandles.forEach((candle, idx) => {
      stochRsi.add(candle.close);
      const result = stochRsi.isStable ? stochRsi.getResult() : null;
      const signal = stochRsi.getSignal();
      chartData.push({x: idx + 1, y: result});

      sampleValues.push({
        period: idx + 1,
        date: candle.date,
        close: candle.close,
        result: result !== null ? result.toFixed(2) : 'N/A',
        signal: signal.state,
      });
    });

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2 select-text">
            StochasticRSI(14) / Required Inputs: {stochRsi.getRequiredInputs()}
          </h2>
          <p className="text-slate-300 select-text">{config.description}</p>
          <p className="text-slate-400 text-sm mt-2 select-text">
            Applies Stochastic Oscillator to RSI values. More sensitive to overbought/oversold than standard RSI.
          </p>
        </div>

        <Chart title="Stochastic RSI (14)" data={chartData} yAxisLabel="StochRSI" color={config.color} />

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-3">All Sample Values</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-600">
                  <th className="text-left text-slate-300 py-2 px-3">Period</th>
                  <th className="text-left text-slate-300 py-2 px-3">Date</th>
                  <th className="text-left text-slate-300 py-2 px-3">Close</th>
                  <th className="text-left text-slate-300 py-2 px-3">StochRSI</th>
                  <th className="text-left text-slate-300 py-2 px-3">Signal</th>
                </tr>
              </thead>
              <tbody>
                {sampleValues.map(row => (
                  <tr key={row.period} className="border-b border-slate-700/50">
                    <td className="text-slate-400 py-2 px-3">{row.period}</td>
                    <td className="text-slate-300 py-2 px-3">{row.date}</td>
                    <td className="text-slate-300 py-2 px-3">${row.close.toFixed(2)}</td>
                    <td className="text-white font-mono py-2 px-3">{row.result}</td>
                    <td className="py-2 px-3">
                      <SignalBadge signal={row.signal} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-purple-900/20 border border-purple-800/50 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-purple-400 mb-2">Code Example</h3>
          <pre className="text-slate-300 text-sm overflow-x-auto">
            <code>{`import { StochasticRSI } from 'trading-signals';

const stochRsi = new StochasticRSI(14);

stochRsi.add(44);
stochRsi.add(45);
stochRsi.add(46);

if (stochRsi.isStable) {
  const result = stochRsi.getResultOrThrow();
  console.log('StochRSI:', result.toFixed(2));
}`}</code>
          </pre>
        </div>
      </div>
    );
  };

  const renderWilliamsR = (config: IndicatorConfig) => {
    const willr = new WilliamsR(14);
    const chartData: ChartDataPoint[] = [];
    const sampleValues: Array<{
      period: number;
      date: string;
      high: number;
      low: number;
      close: number;
      result: string;
      signal: string;
    }> = [];

    ethCandles.forEach((candle, idx) => {
      willr.add(candle);
      const result = willr.isStable ? willr.getResult() : null;
      const signal = willr.getSignal();
      chartData.push({x: idx + 1, y: result});

      sampleValues.push({
        period: idx + 1,
        date: candle.date,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        result: result !== null ? result.toFixed(2) : 'N/A',
        signal: signal.state,
      });
    });

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2 select-text">
            WilliamsR(14) / Required Inputs: {willr.getRequiredInputs()}
          </h2>
          <p className="text-slate-300 select-text">{config.description}</p>
          <p className="text-slate-400 text-sm mt-2 select-text">
            Measures overbought and oversold levels on an inverted scale from 0 to -100. Values from 0 to -20 indicate
            overbought conditions, while -80 to -100 indicate oversold conditions.
          </p>
        </div>

        <Chart title="Williams %R (14)" data={chartData} yAxisLabel="Williams %R" color={config.color} />

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-3">All Sample Values</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-600">
                  <th className="text-left text-slate-300 py-2 px-3">Period</th>
                  <th className="text-left text-slate-300 py-2 px-3">Date</th>
                  <th className="text-left text-slate-300 py-2 px-3">High</th>
                  <th className="text-left text-slate-300 py-2 px-3">Low</th>
                  <th className="text-left text-slate-300 py-2 px-3">Close</th>
                  <th className="text-left text-slate-300 py-2 px-3">Williams %R</th>
                  <th className="text-left text-slate-300 py-2 px-3">Signal</th>
                </tr>
              </thead>
              <tbody>
                {sampleValues.map(row => (
                  <tr key={row.period} className="border-b border-slate-700/50">
                    <td className="text-slate-400 py-2 px-3">{row.period}</td>
                    <td className="text-slate-300 py-2 px-3">{row.date}</td>
                    <td className="text-slate-300 py-2 px-3">${row.high.toFixed(2)}</td>
                    <td className="text-slate-300 py-2 px-3">${row.low.toFixed(2)}</td>
                    <td className="text-slate-300 py-2 px-3">${row.close.toFixed(2)}</td>
                    <td className="text-white font-mono py-2 px-3">{row.result}</td>
                    <td className="py-2 px-3">
                      <SignalBadge signal={row.signal} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-purple-900/20 border border-purple-800/50 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-purple-400 mb-2">Code Example</h3>
          <pre className="text-slate-300 text-sm overflow-x-auto">
            <code>{`import { WilliamsR } from 'trading-signals';

const willr = new WilliamsR(14);

willr.add({ high: 107, low: 95, close: 102 });
willr.add({ high: 110, low: 98, close: 108 });
willr.add({ high: 112, low: 100, close: 105 });

if (willr.isStable) {
  console.log('Williams %R:', willr.getResultOrThrow().toFixed(2));
}`}</code>
          </pre>
        </div>
      </div>
    );
  };

  const renderTDS = (config: IndicatorConfig) => {
    const tds = new TDS();
    const chartData: ChartDataPoint[] = [];
    const results: Array<{
      period: number;
      date: string;
      close: number;
      result: string;
      signal: string;
    }> = [];

    for (const [index, candle] of ethCandles.entries()) {
      tds.add(candle.close);
      const result = tds.getResult();
      chartData.push({x: index + 1, y: result});
      results.push({
        period: index + 1,
        date: candle.date,
        close: candle.close,
        result: result !== null ? result.toString() : 'null',
        signal: tds.getSignal().state,
      });
    }

    const sampleValues = results;

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">TDS() / Required Inputs: {tds.getRequiredInputs()}</h2>
          <p className="text-slate-300">{config.description}</p>
        </div>

        <Chart title="Tom DeMark Sequential" data={chartData} yAxisLabel="TDS" color={config.color} />

        <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Calculation</h3>
          <div className="prose prose-invert max-w-none">
            <p className="text-slate-300">TDS tracks consecutive closes compared to the close 4 bars earlier:</p>
            <ul className="text-slate-300 space-y-2">
              <li>
                Bullish Setup: 9 consecutive closes greater than the close 4 bars earlier (returns 1, signals potential
                reversal - BEARISH)
              </li>
              <li>
                Bearish Setup: 9 consecutive closes less than the close 4 bars earlier (returns -1, signals potential
                reversal - BULLISH)
              </li>
            </ul>
            <p className="text-slate-300 mt-4">
              TDS identifies potential turning points after extended price moves. The signal is inverted because it
              detects overbought/oversold conditions.
            </p>
          </div>
        </div>

        <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">All Sample Values</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-600">
                  <th className="text-left text-slate-300 py-2 px-3">Period</th>
                  <th className="text-left text-slate-300 py-2 px-3">Date</th>
                  <th className="text-left text-slate-300 py-2 px-3">Close</th>
                  <th className="text-left text-slate-300 py-2 px-3">TDS</th>
                  <th className="text-left text-slate-300 py-2 px-3">Signal</th>
                </tr>
              </thead>
              <tbody>
                {sampleValues.map(row => (
                  <tr key={row.period} className="border-b border-slate-700/50">
                    <td className="text-slate-400 py-2 px-3">{row.period}</td>
                    <td className="text-slate-300 py-2 px-3">{row.date}</td>
                    <td className="text-slate-300 py-2 px-3">${row.close.toFixed(2)}</td>
                    <td className="text-white font-mono py-2 px-3">{row.result}</td>
                    <td className="py-2 px-3">
                      <SignalBadge signal={row.signal} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-purple-900/20 border border-purple-800/50 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-purple-400 mb-2">Code Example</h3>
          <pre className="text-slate-300 text-sm overflow-x-auto">
            <code>{`import { TDS } from 'trading-signals';

const tds = new TDS();

tds.add(100);
tds.add(102);
tds.add(105);
// ... add more closes

if (tds.isStable) {
  const result = tds.getResultOrThrow();
  console.log('TDS:', result); // 1 (bullish setup) or -1 (bearish setup)
  console.log('Signal:', tds.getSignal().state); // Inverted: 1 → BEARISH, -1 → BULLISH
}`}</code>
          </pre>
        </div>
      </div>
    );
  };

  return (
    <div className="flex gap-6">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0">
        <div className="sticky top-6 bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-white mb-4">Momentum Indicators</h2>
          <nav className="space-y-1">
            {indicators.map(indicator => (
              <button
                key={indicator.id}
                onClick={() => handleIndicatorChange(indicator.id)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  selectedIndicator === indicator.id
                    ? 'bg-purple-600 text-white font-medium'
                    : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                }`}>
                <div className="font-medium">{indicator.name}</div>
                <div className="text-xs opacity-75">{indicator.description}</div>
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0">{renderIndicatorContent()}</main>
    </div>
  );
}
