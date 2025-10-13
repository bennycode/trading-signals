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
    const prices = [44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63];
    const rsi = new RSI(14);
    const chartData: ChartDataPoint[] = [];
    const sampleValues: Array<{period: number; price: number; result: string}> = [];

    prices.forEach((price, idx) => {
      rsi.add(price);
      const result = rsi.isStable ? rsi.getResult() : null;
      chartData.push({x: idx + 1, y: result});

      sampleValues.push({
        period: idx + 1,
        price,
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
                  <th className="text-left text-slate-300 py-2 px-3">Price</th>
                  <th className="text-left text-slate-300 py-2 px-3">RSI</th>
                </tr>
              </thead>
              <tbody>
                {sampleValues.map(row => (
                  <tr key={row.period} className="border-b border-slate-700/50">
                    <td className="text-slate-400 py-2 px-3">{row.period}</td>
                    <td className="text-slate-300 py-2 px-3">{row.price.toFixed(2)}</td>
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
    const prices = [45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62];
    const stoch = new StochasticOscillator(14, 3, 3);
    const chartDataK: ChartDataPoint[] = [];
    const chartDataD: ChartDataPoint[] = [];
    const sampleValues: Array<{period: number; close: number; k: string; d: string}> = [];

    prices.forEach((price, idx) => {
      stoch.add({high: price + 5, low: price - 5, close: price});
      const result = stoch.isStable ? stoch.getResult() : null;
      chartDataK.push({x: idx + 1, y: result?.stochK ?? null});
      chartDataD.push({x: idx + 1, y: result?.stochD ?? null});

      sampleValues.push({
        period: idx + 1,
        close: price,
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
                  <th className="text-left text-slate-300 py-2 px-3">Close</th>
                  <th className="text-left text-slate-300 py-2 px-3">%K</th>
                  <th className="text-left text-slate-300 py-2 px-3">%D</th>
                </tr>
              </thead>
              <tbody>
                {sampleValues.map(row => (
                  <tr key={row.period} className="border-b border-slate-700/50">
                    <td className="text-slate-400 py-2 px-3">{row.period}</td>
                    <td className="text-slate-300 py-2 px-3">{row.close.toFixed(2)}</td>
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
    const prices = [50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70];
    const cci = new CCI(20);
    const chartData: ChartDataPoint[] = [];
    const sampleValues: Array<{period: number; close: number; result: string}> = [];

    prices.forEach((price, idx) => {
      cci.add({high: price + 2, low: price - 2, close: price});
      const result = cci.isStable ? cci.getResult() : null;
      chartData.push({x: idx + 1, y: result});

      sampleValues.push({
        period: idx + 1,
        close: price,
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
    const sampleValues: Array<{period: number; price: number; result: string}> = [];

    prices.forEach((price, idx) => {
      roc.add(price);
      const result = roc.isStable ? roc.getResult() : null;
      chartData.push({x: idx + 1, y: result});

      sampleValues.push({
        period: idx + 1,
        price,
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
                  <th className="text-left text-slate-300 py-2 px-3">Price</th>
                  <th className="text-left text-slate-300 py-2 px-3">ROC %</th>
                </tr>
              </thead>
              <tbody>
                {sampleValues.map(row => (
                  <tr key={row.period} className="border-b border-slate-700/50">
                    <td className="text-slate-400 py-2 px-3">{row.period}</td>
                    <td className="text-slate-300 py-2 px-3">{row.price.toFixed(2)}</td>
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
    const prices = [
      12, 12.5, 13, 13.5, 14, 14.5, 15, 15.5, 16, 16.5, 17, 17.5, 18, 18.5, 19, 19.5, 20, 20.5, 21, 21.5, 22, 22.5, 23,
      23.5, 24, 24.5, 25, 25.5, 26,
    ];
    const macd = new MACD(new EMA(12), new EMA(26), new EMA(9));
    const chartData: ChartDataPoint[] = [];
    const sampleValues: Array<{period: number; price: number; result: string}> = [];

    prices.forEach((price, idx) => {
      macd.add(price);
      const result = macd.isStable ? macd.getResult() : null;
      chartData.push({x: idx + 1, y: result?.macd ?? null});

      sampleValues.push({
        period: idx + 1,
        price,
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
                  <th className="text-left text-slate-300 py-2 px-3">Price</th>
                  <th className="text-left text-slate-300 py-2 px-3">MACD</th>
                </tr>
              </thead>
              <tbody>
                {sampleValues.map(row => (
                  <tr key={row.period} className="border-b border-slate-700/50">
                    <td className="text-slate-400 py-2 px-3">{row.period}</td>
                    <td className="text-slate-300 py-2 px-3">{row.price.toFixed(2)}</td>
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
    const candles = Array.from({length: 40}, (_, i) => ({
      high: 100 + i * 2 + 5,
      low: 100 + i * 2 - 5,
    }));
    const ao = new AO(5, 34);
    const chartData: ChartDataPoint[] = [];
    const sampleValues: Array<{period: number; high: number; low: number; result: string}> = [];

    candles.forEach((candle, idx) => {
      ao.add(candle);
      const result = ao.isStable ? ao.getResult() : null;
      chartData.push({x: idx + 1, y: result});

      sampleValues.push({
        period: idx + 1,
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
                  <th className="text-left text-slate-300 py-2 px-3">High</th>
                  <th className="text-left text-slate-300 py-2 px-3">Low</th>
                  <th className="text-left text-slate-300 py-2 px-3">AO</th>
                </tr>
              </thead>
              <tbody>
                {sampleValues.map(row => (
                  <tr key={row.period} className="border-b border-slate-700/50">
                    <td className="text-slate-400 py-2 px-3">{row.period}</td>
                    <td className="text-slate-300 py-2 px-3">{row.high.toFixed(2)}</td>
                    <td className="text-slate-300 py-2 px-3">{row.low.toFixed(2)}</td>
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
    const candles = Array.from({length: 40}, (_, i) => ({
      high: 100 + i + 5,
      low: 100 + i - 5,
    }));
    const ac = new AC(5, 34, 5);
    const chartData: ChartDataPoint[] = [];
    const sampleValues: Array<{period: number; high: number; low: number; result: string}> = [];

    candles.forEach((candle, idx) => {
      ac.add(candle);
      const result = ac.isStable ? ac.getResult() : null;
      chartData.push({x: idx + 1, y: result});

      sampleValues.push({
        period: idx + 1,
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
                  <th className="text-left text-slate-300 py-2 px-3">High</th>
                  <th className="text-left text-slate-300 py-2 px-3">Low</th>
                  <th className="text-left text-slate-300 py-2 px-3">AC</th>
                </tr>
              </thead>
              <tbody>
                {sampleValues.map(row => (
                  <tr key={row.period} className="border-b border-slate-700/50">
                    <td className="text-slate-400 py-2 px-3">{row.period}</td>
                    <td className="text-slate-300 py-2 px-3">{row.high.toFixed(2)}</td>
                    <td className="text-slate-300 py-2 px-3">{row.low.toFixed(2)}</td>
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
    const prices = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
    const cg = new CG(10, 10);
    const chartData: ChartDataPoint[] = [];
    const sampleValues: Array<{period: number; price: number; result: string}> = [];

    prices.forEach((price, idx) => {
      cg.add(price);
      const result = cg.isStable ? cg.getResult() : null;
      chartData.push({x: idx + 1, y: result});

      sampleValues.push({
        period: idx + 1,
        price,
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
                  <th className="text-left text-slate-300 py-2 px-3">Price</th>
                  <th className="text-left text-slate-300 py-2 px-3">CG</th>
                </tr>
              </thead>
              <tbody>
                {sampleValues.map(row => (
                  <tr key={row.period} className="border-b border-slate-700/50">
                    <td className="text-slate-400 py-2 px-3">{row.period}</td>
                    <td className="text-slate-300 py-2 px-3">{row.price.toFixed(2)}</td>
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
    const prices = [100, 102, 105, 107, 110, 108, 106, 109, 112, 115, 113, 111, 114];
    const mom = new MOM(5);
    const chartData: ChartDataPoint[] = [];
    const sampleValues: Array<{period: number; price: number; result: string}> = [];

    prices.forEach((price, idx) => {
      mom.add(price);
      const result = mom.isStable ? mom.getResult() : null;
      chartData.push({x: idx + 1, y: result});

      sampleValues.push({
        period: idx + 1,
        price,
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
                  <th className="text-left text-slate-300 py-2 px-3">Price</th>
                  <th className="text-left text-slate-300 py-2 px-3">MOM</th>
                </tr>
              </thead>
              <tbody>
                {sampleValues.map(row => (
                  <tr key={row.period} className="border-b border-slate-700/50">
                    <td className="text-slate-400 py-2 px-3">{row.period}</td>
                    <td className="text-slate-300 py-2 px-3">{row.price.toFixed(2)}</td>
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
    const candles = [
      {open: 100, high: 101, low: 99, close: 100, volume: 1000},
      {open: 100, high: 103, low: 100, close: 102, volume: 1200},
      {open: 102, high: 102, low: 100, close: 101, volume: 900},
      {open: 101, high: 106, low: 101, close: 105, volume: 1500},
      {open: 105, high: 108, low: 105, close: 107, volume: 1300},
      {open: 107, high: 107, low: 105, close: 106, volume: 1100},
      {open: 106, high: 111, low: 106, close: 110, volume: 1800},
      {open: 110, high: 113, low: 110, close: 112, volume: 1600},
    ];
    const obv = new OBV();
    const chartData: ChartDataPoint[] = [];
    const sampleValues: Array<{period: number; close: number; volume: number; result: string}> = [];

    candles.forEach((candle, idx) => {
      obv.add(candle);
      const result = obv.getResult();
      chartData.push({x: idx + 1, y: result});

      sampleValues.push({
        period: idx + 1,
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
                  <th className="text-left text-slate-300 py-2 px-3">Close</th>
                  <th className="text-left text-slate-300 py-2 px-3">Volume</th>
                  <th className="text-left text-slate-300 py-2 px-3">OBV</th>
                </tr>
              </thead>
              <tbody>
                {sampleValues.map(row => (
                  <tr key={row.period} className="border-b border-slate-700/50">
                    <td className="text-slate-400 py-2 px-3">{row.period}</td>
                    <td className="text-slate-300 py-2 px-3">{row.close.toFixed(2)}</td>
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
    const candles = Array.from({length: 15}, (_, i) => ({
      high: 100 + i * 2 + Math.random() * 5,
      low: 100 + i * 2 - Math.random() * 5,
      close: 100 + i * 2,
    }));
    const rei = new REI(5);
    const chartData: ChartDataPoint[] = [];
    const sampleValues: Array<{period: number; close: number; result: string}> = [];

    candles.forEach((candle, idx) => {
      rei.add(candle);
      const result = rei.isStable ? rei.getResult() : null;
      chartData.push({x: idx + 1, y: result});

      sampleValues.push({
        period: idx + 1,
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
                  <th className="text-left text-slate-300 py-2 px-3">Close</th>
                  <th className="text-left text-slate-300 py-2 px-3">REI</th>
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
    const prices = [44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63];
    const stochRsi = new StochasticRSI(14);
    const chartData: ChartDataPoint[] = [];
    const sampleValues: Array<{period: number; price: number; result: string}> = [];

    prices.forEach((price, idx) => {
      stochRsi.add(price);
      const result = stochRsi.isStable ? stochRsi.getResult() : null;
      chartData.push({x: idx + 1, y: result});

      sampleValues.push({
        period: idx + 1,
        price,
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
                  <th className="text-left text-slate-300 py-2 px-3">Price</th>
                  <th className="text-left text-slate-300 py-2 px-3">StochRSI</th>
                </tr>
              </thead>
              <tbody>
                {sampleValues.map(row => (
                  <tr key={row.period} className="border-b border-slate-700/50">
                    <td className="text-slate-400 py-2 px-3">{row.period}</td>
                    <td className="text-slate-300 py-2 px-3">{row.price.toFixed(2)}</td>
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
    <div className="flex gap-6">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0">
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
