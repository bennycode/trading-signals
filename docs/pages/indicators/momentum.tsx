import {useState} from 'react';
import {
  RSI,
  StochasticOscillator,
  CCI,
  ROC,
  AO,
  AC,
  CG,
  MOM,
  OBV,
  REI,
  StochasticRSI,
  MACD,
  EMA,
} from 'trading-signals';
import Chart, {ChartDataPoint} from '../../components/Chart';

interface IndicatorConfig {
  id: string;
  name: string;
  description: string;
  color: string;
}

// AMD OHLCV data (latest 40 candles, oldest first for chronological order)
const amdCandles = [
  {date: '07/15/2025', open: 153.75, high: 158.68, low: 153.56, close: 155.61, volume: 93370078},
  {date: '07/16/2025', open: 155.31, high: 160.36, low: 152.85, close: 160.08, volume: 59492762},
  {date: '07/17/2025', open: 161.81, high: 161.96, low: 158.68, close: 160.41, volume: 50605121},
  {date: '07/18/2025', open: 159.59, high: 160.83, low: 155.81, close: 156.99, volume: 48859840},
  {date: '07/21/2025', open: 157.62, high: 160.34, low: 156.92, close: 157.0, volume: 39021129},
  {date: '07/22/2025', open: 156.2, high: 156.23, low: 149.34, close: 154.72, volume: 49028020},
  {date: '07/23/2025', open: 156.32, high: 159.45, low: 156.0, close: 158.65, volume: 41510898},
  {date: '07/24/2025', open: 159.12, high: 163.93, low: 158.36, close: 162.12, volume: 48440113},
  {date: '07/25/2025', open: 163.51, high: 167.18, low: 162.36, close: 166.47, volume: 53432262},
  {date: '07/28/2025', open: 169.08, high: 174.7, low: 168.67, close: 173.66, volume: 68267844},
  {date: '07/29/2025', open: 175.21, high: 182.31, low: 174.68, close: 177.44, volume: 108154797},
  {date: '07/30/2025', open: 175.61, high: 180.37, low: 173.8, close: 179.51, volume: 64820289},
  {date: '07/31/2025', open: 182.02, high: 182.5, low: 173.0, close: 176.31, volume: 71765289},
  {date: '08/01/2025', open: 170.16, high: 174.4, low: 166.82, close: 171.7, volume: 75396125},
  {date: '08/04/2025', open: 174.61, high: 177.86, low: 173.56, close: 176.78, volume: 52951039},
  {date: '08/05/2025', open: 177.57, high: 177.99, low: 171.8, close: 174.31, volume: 88808523},
  {date: '08/06/2025', open: 165.05, high: 166.18, low: 157.8, close: 163.12, volume: 133641797},
  {date: '08/07/2025', open: 166.84, high: 175.75, low: 166.7, close: 172.4, volume: 95448312},
  {date: '08/08/2025', open: 174.04, high: 176.48, low: 170.52, close: 172.76, volume: 68866688},
  {date: '08/11/2025', open: 170.04, high: 178.82, low: 169.38, close: 172.28, volume: 70651031},
  {date: '08/12/2025', open: 173.32, high: 175.16, low: 168.5, close: 174.95, volume: 52335754},
  {date: '08/13/2025', open: 179.91, high: 186.65, low: 179.38, close: 184.42, volume: 108305102},
  {date: '08/14/2025', open: 179.83, high: 185.44, low: 179.56, close: 180.95, volume: 66308820},
  {date: '08/15/2025', open: 180.06, high: 180.14, low: 176.25, close: 177.51, volume: 51543141},
  {date: '08/18/2025', open: 176.76, high: 178.8, low: 174.36, close: 176.14, volume: 35937527},
  {date: '08/19/2025', open: 173.1, high: 173.17, low: 166.1, close: 166.55, volume: 64455008},
  {date: '08/20/2025', open: 164.1, high: 166.65, low: 158.25, close: 165.2, volume: 60233230},
  {date: '08/21/2025', open: 165.86, high: 165.88, low: 162.26, close: 163.71, volume: 37880461},
  {date: '08/22/2025', open: 162.17, high: 168.53, low: 161.8, close: 167.76, volume: 43998609},
  {date: '08/25/2025', open: 165.55, high: 165.59, low: 161.72, close: 163.36, volume: 36134680},
  {date: '08/26/2025', open: 168.65, high: 169.77, low: 164.91, close: 166.62, volume: 52138559},
  {date: '08/27/2025', open: 166.04, high: 167.68, low: 164.65, close: 167.13, volume: 37031039},
  {date: '08/28/2025', open: 168.5, high: 170.99, low: 166.65, close: 168.58, volume: 36285191},
  {date: '08/29/2025', open: 166.81, high: 168.57, low: 161.9, close: 162.63, volume: 37516820},
  {date: '09/02/2025', open: 158.42, high: 162.39, low: 156.62, close: 162.32, volume: 38656129},
  {date: '09/03/2025', open: 161.81, high: 164.75, low: 160.58, close: 162.13, volume: 30752789},
  {date: '09/04/2025', open: 159.94, high: 162.05, low: 157.79, close: 161.79, volume: 32103500},
  {date: '09/05/2025', open: 157.12, high: 157.14, low: 150.18, close: 151.14, volume: 78255953},
  {date: '09/08/2025', open: 151.8, high: 152.64, low: 149.22, close: 151.41, volume: 41849000},
  {date: '09/09/2025', open: 151.99, high: 156.66, low: 151.93, close: 155.82, volume: 42802473},
].reverse(); // Reverse to get most recent first for display

const indicators: IndicatorConfig[] = [
  {id: 'rsi', name: 'RSI', description: 'Relative Strength Index', color: '#8b5cf6'},
  {id: 'stoch', name: 'Stochastic', description: 'Stochastic Oscillator', color: '#ec4899'},
  {id: 'cci', name: 'CCI', description: 'Commodity Channel Index', color: '#f59e0b'},
  {id: 'roc', name: 'ROC', description: 'Rate of Change', color: '#10b981'},
  {id: 'macd', name: 'MACD', description: 'Moving Average Convergence Divergence', color: '#3b82f6'},
  {id: 'ao', name: 'AO', description: 'Awesome Oscillator', color: '#06b6d4'},
  {id: 'ac', name: 'AC', description: 'Accelerator Oscillator', color: '#6366f1'},
  {id: 'cg', name: 'CG', description: 'Center of Gravity', color: '#f97316'},
  {id: 'mom', name: 'MOM', description: 'Momentum', color: '#84cc16'},
  {id: 'obv', name: 'OBV', description: 'On-Balance Volume', color: '#14b8a6'},
  {id: 'rei', name: 'REI', description: 'Range Expansion Index', color: '#a855f7'},
  {id: 'stochrsi', name: 'StochRSI', description: 'Stochastic RSI', color: '#ef4444'},
];

export default function MomentumIndicators() {
  const [selectedIndicator, setSelectedIndicator] = useState<string>('rsi');

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
      default:
        return null;
    }
  };

  const renderRSI = (config: IndicatorConfig) => {
    const rsi = new RSI(14);
    const chartData: ChartDataPoint[] = [];
    const sampleValues: Array<{period: number; date: string; close: number; result: string}> = [];

    amdCandles.forEach((candle, idx) => {
      rsi.add(candle.close);
      const result = rsi.isStable ? rsi.getResult() : null;
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
          <h2 className="text-2xl font-bold text-white mb-2">{config.name}</h2>
          <p className="text-slate-300">{config.description}</p>
          <p className="text-slate-400 text-sm mt-2">
            RSI measures the magnitude of recent price changes to evaluate overbought or oversold conditions. Values
            above 70 indicate overbought, below 30 indicate oversold.
          </p>
        </div>

        <Chart title="RSI (14-period)" data={chartData} yAxisLabel="RSI" color={config.color} />

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
                </tr>
              </thead>
              <tbody>
                {sampleValues.map(row => (
                  <tr key={row.period} className="border-b border-slate-700/50">
                    <td className="text-slate-400 py-2 px-3">{row.period}</td>
                    <td className="text-slate-400 py-2 px-3">{row.date}</td>
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
    const sampleValues: Array<{period: number; date: string; close: number; k: string; d: string}> = [];

    amdCandles.forEach((candle, idx) => {
      stoch.add({high: candle.high, low: candle.low, close: candle.close});
      const result = stoch.isStable ? stoch.getResult() : null;
      chartDataK.push({x: idx + 1, y: result?.stochK ?? null});
      chartDataD.push({x: idx + 1, y: result?.stochD ?? null});

      sampleValues.push({
        period: idx + 1,
        date: candle.date,
        close: candle.close,
        k: result ? result.stochK.toFixed(2) : 'N/A',
        d: result ? result.stochD.toFixed(2) : 'N/A',
      });
    });

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">{config.name}</h2>
          <p className="text-slate-300">{config.description}</p>
          <p className="text-slate-400 text-sm mt-2">
            Compares closing price to price range over a period. %K crossing above %D can signal a buying opportunity.
          </p>
        </div>

        <Chart title="Stochastic %K" data={chartDataK} yAxisLabel="%K" color={config.color} />
        <Chart title="Stochastic %D" data={chartDataD} yAxisLabel="%D" color="#f97316" />

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
    const sampleValues: Array<{period: number; date: string; close: number; result: string}> = [];

    amdCandles.forEach((candle, idx) => {
      cci.add({high: candle.high, low: candle.low, close: candle.close});
      const result = cci.isStable ? cci.getResult() : null;
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
          <h2 className="text-2xl font-bold text-white mb-2">{config.name}</h2>
          <p className="text-slate-300">{config.description}</p>
          <p className="text-slate-400 text-sm mt-2">
            Measures deviation from the average price. Readings above +100 suggest overbought, below -100 suggest
            oversold.
          </p>
        </div>

        <Chart title="CCI (20-period)" data={chartData} yAxisLabel="CCI" color={config.color} />

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-3">All Sample Values</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-600">
                  <th className="text-left text-slate-300 py-2 px-3">Period</th>
                  <th className="text-left text-slate-300 py-2 px-3">Close</th>
                  <th className="text-left text-slate-300 py-2 px-3">CCI</th>
                </tr>
              </thead>
              <tbody>
                {sampleValues.map(row => (
                  <tr key={row.period} className="border-b border-slate-700/50">
                    <td className="text-slate-400 py-2 px-3">{row.period}</td>
                    <td className="text-slate-300 py-2 px-3">{row.close.toFixed(2)}</td>
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
    const sampleValues: Array<{period: number; date: string; close: number; result: string}> = [];

    amdCandles.forEach((candle, idx) => {
      roc.add(candle.close);
      const result = roc.isStable ? roc.getResult() : null;
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
          <h2 className="text-2xl font-bold text-white mb-2">{config.name}</h2>
          <p className="text-slate-300">{config.description}</p>
          <p className="text-slate-400 text-sm mt-2">
            Measures the percentage change in price from n periods ago. Positive values indicate upward momentum,
            negative values indicate downward momentum.
          </p>
        </div>

        <Chart title="ROC (9-period)" data={chartData} yAxisLabel="ROC %" color={config.color} />

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
    const chartData: ChartDataPoint[] = [];
    const sampleValues: Array<{period: number; date: string; close: number; result: string}> = [];

    amdCandles.forEach((candle, idx) => {
      macd.add(candle.close);
      const result = macd.isStable ? macd.getResult() : null;
      chartData.push({x: idx + 1, y: result?.macd ?? null});

      sampleValues.push({
        period: idx + 1,
        date: candle.date,
        close: candle.close,
        result: result ? `${result.macd.toFixed(4)}` : 'N/A',
      });
    });

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">{config.name}</h2>
          <p className="text-slate-300">{config.description}</p>
          <p className="text-slate-400 text-sm mt-2">
            Shows relationship between two moving averages. Crossing above signal line = bullish, crossing below =
            bearish.
          </p>
        </div>

        <Chart title="MACD Line" data={chartData} yAxisLabel="MACD" color={config.color} />

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
    const sampleValues: Array<{period: number; date: string; high: number; low: number; result: string}> = [];

    amdCandles.forEach((candle, idx) => {
      ao.add(candle);
      const result = ao.isStable ? ao.getResult() : null;
      chartData.push({x: idx + 1, y: result});

      sampleValues.push({
        period: idx + 1,
        date: candle.date,
        high: candle.high,
        low: candle.low,
        result: result !== null ? result.toFixed(2) : 'N/A',
      });
    });

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">{config.name}</h2>
          <p className="text-slate-300">{config.description}</p>
          <p className="text-slate-400 text-sm mt-2">
            Measures market momentum using the difference between a 5-period and 34-period simple moving average of the
            bar's midpoints.
          </p>
        </div>

        <Chart title="Awesome Oscillator" data={chartData} yAxisLabel="AO" color={config.color} />

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
    const sampleValues: Array<{period: number; date: string; high: number; low: number; result: string}> = [];

    amdCandles.forEach((candle, idx) => {
      ac.add(candle);
      const result = ac.isStable ? ac.getResult() : null;
      chartData.push({x: idx + 1, y: result});

      sampleValues.push({
        period: idx + 1,
        date: candle.date,
        high: candle.high,
        low: candle.low,
        result: result !== null ? result.toFixed(2) : 'N/A',
      });
    });

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">{config.name}</h2>
          <p className="text-slate-300">{config.description}</p>
          <p className="text-slate-400 text-sm mt-2">
            Shows acceleration or deceleration of the current driving force. Earlier signal of potential trend change
            than AO.
          </p>
        </div>

        <Chart title="Accelerator Oscillator" data={chartData} yAxisLabel="AC" color={config.color} />

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

    amdCandles.forEach((candle, idx) => {
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
          <h2 className="text-2xl font-bold text-white mb-2">{config.name}</h2>
          <p className="text-slate-300">{config.description}</p>
          <p className="text-slate-400 text-sm mt-2">
            Identifies turning points with minimal lag. Oscillates around zero line.
          </p>
        </div>

        <Chart title="Center of Gravity" data={chartData} yAxisLabel="CG" color={config.color} />

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

    amdCandles.forEach((candle, idx) => {
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
          <h2 className="text-2xl font-bold text-white mb-2">{config.name}</h2>
          <p className="text-slate-300">{config.description}</p>
          <p className="text-slate-400 text-sm mt-2">
            Simple momentum calculation: current price minus price n periods ago.
          </p>
        </div>

        <Chart title="Momentum (5-period)" data={chartData} yAxisLabel="MOM" color={config.color} />

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
    const obv = new OBV();
    const chartData: ChartDataPoint[] = [];
    const sampleValues: Array<{period: number; date: string; close: number; volume: number; result: string}> = [];

    amdCandles.forEach((candle, idx) => {
      obv.add(candle);
      const result = obv.getResult();
      chartData.push({x: idx + 1, y: result});

      sampleValues.push({
        period: idx + 1,
        date: candle.date,
        close: candle.close,
        volume: candle.volume,
        result: result !== null ? result.toFixed(0) : 'N/A',
      });
    });

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">{config.name}</h2>
          <p className="text-slate-300">{config.description}</p>
          <p className="text-slate-400 text-sm mt-2">
            Cumulative volume-based indicator. Rising OBV with rising prices confirms uptrend.
          </p>
        </div>

        <Chart title="On-Balance Volume" data={chartData} yAxisLabel="OBV" color={config.color} />

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

const obv = new OBV();

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
    const sampleValues: Array<{period: number; date: string; close: number; result: string}> = [];

    amdCandles.forEach((candle, idx) => {
      rei.add(candle);
      const result = rei.isStable ? rei.getResult() : null;
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
          <h2 className="text-2xl font-bold text-white mb-2">{config.name}</h2>
          <p className="text-slate-300">{config.description}</p>
          <p className="text-slate-400 text-sm mt-2">Measures range expansion to identify potential breakouts.</p>
        </div>

        <Chart title="Range Expansion Index" data={chartData} yAxisLabel="REI" color={config.color} />

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
    const sampleValues: Array<{period: number; date: string; close: number; result: string}> = [];

    amdCandles.forEach((candle, idx) => {
      stochRsi.add(candle.close);
      const result = stochRsi.isStable ? stochRsi.getResult() : null;
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
          <h2 className="text-2xl font-bold text-white mb-2">{config.name}</h2>
          <p className="text-slate-300">{config.description}</p>
          <p className="text-slate-400 text-sm mt-2">
            Applies Stochastic Oscillator to RSI values. More sensitive to overbought/oversold than standard RSI.
          </p>
        </div>

        <Chart title="Stochastic RSI" data={chartData} yAxisLabel="StochRSI" color={config.color} />

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

  return (
    <div className="space-y-6 lg:space-y-0 lg:flex lg:gap-6">
      {/* Mobile Dropdown Selector */}
      <div className="lg:hidden">
        <label htmlFor="indicator-select" className="block text-sm font-medium text-slate-300 mb-2">
          Select Indicator:
        </label>
        <select
          id="indicator-select"
          value={selectedIndicator}
          onChange={e => setSelectedIndicator(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-600">
          {indicators.map(indicator => (
            <option key={indicator.id} value={indicator.id}>
              {indicator.name} - {indicator.description}
            </option>
          ))}
        </select>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 flex-shrink-0">
        <div className="sticky top-6 bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-white mb-4">Momentum Indicators</h2>
          <nav className="space-y-1">
            {indicators.map(indicator => (
              <button
                key={indicator.id}
                onClick={() => setSelectedIndicator(indicator.id)}
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
