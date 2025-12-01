import {SMA, EMA, DEMA, WMA, MACD} from 'trading-signals';
import IndicatorDemo, {IndicatorExample} from '../../components/IndicatorDemo';

export default function TrendIndicators() {
  const examples: IndicatorExample[] = [
    {
      name: 'Simple Moving Average (SMA)',
      description: 'Calculates the average of a specified number of prices',
      code: `import { SMA } from 'trading-signals';

const sma = new SMA(5);

sma.add(81);
sma.add(24);
sma.add(75);
sma.add(21);
sma.add(34);

console.log(sma.getResult()); // 47`,
      inputValues: [81, 24, 75, 21, 34],
      calculate: values => {
        const sma = new SMA(5);
        const allResults: Array<{value: number; result: string | null}> = [];

        for (const value of values) {
          sma.add(value);
          const result = sma.isStable ? sma.getResult()!.toFixed(2) : null;
          allResults.push({value, result});
        }

        return {
          result: sma.isStable ? sma.getResult()!.toFixed(2) : null,
          allResults,
        };
      },
    },
    {
      name: 'Exponential Moving Average (EMA)',
      description: 'Gives more weight to recent prices, reacting faster to price changes',
      code: `import { EMA } from 'trading-signals';

const ema = new EMA(5);

ema.add(81);
ema.add(24);
ema.add(75);
ema.add(21);
ema.add(34);

console.log(ema.getResult());`,
      inputValues: [81, 24, 75, 21, 34, 53, 44],
      calculate: values => {
        const ema = new EMA(5);
        const allResults: Array<{value: number; result: string | null}> = [];

        for (const value of values) {
          ema.add(value);
          const result = ema.isStable ? ema.getResult()!.toFixed(2) : null;
          allResults.push({value, result});
        }

        return {
          result: ema.isStable ? ema.getResult()!.toFixed(2) : null,
          allResults,
        };
      },
    },
    {
      name: 'Double Exponential Moving Average (DEMA)',
      description: 'Reduces lag by applying EMA twice, providing faster signals',
      code: `import { DEMA } from 'trading-signals';

const dema = new DEMA(5);

for (const price of prices) {
  dema.add(price);
}

console.log(dema.getResult());`,
      inputValues: [81, 24, 75, 21, 34, 53, 44, 66, 89, 101],
      calculate: values => {
        const dema = new DEMA(5);
        const allResults: Array<{value: number; result: string | null}> = [];

        for (const value of values) {
          dema.add(value);
          const result = dema.isStable ? dema.getResult()!.toFixed(2) : null;
          allResults.push({value, result});
        }

        return {
          result: dema.isStable ? dema.getResult()!.toFixed(2) : null,
          allResults,
        };
      },
    },
    {
      name: 'Weighted Moving Average (WMA)',
      description: 'Assigns higher weights to recent data points',
      code: `import { WMA } from 'trading-signals';

const wma = new WMA(5);

wma.add(91);
wma.add(90);
wma.add(89);
wma.add(88);
wma.add(90);

console.log(wma.getResult());`,
      inputValues: [91, 90, 89, 88, 90],
      calculate: values => {
        const wma = new WMA(5);
        const allResults: Array<{value: number; result: string | null}> = [];

        for (const value of values) {
          wma.add(value);
          const result = wma.isStable ? wma.getResult()!.toFixed(2) : null;
          allResults.push({value, result});
        }

        return {
          result: wma.isStable ? wma.getResult()!.toFixed(2) : null,
          allResults,
        };
      },
    },
    {
      name: 'MACD (Moving Average Convergence Divergence)',
      description: 'Shows the relationship between two moving averages',
      code: `import { EMA, MACD } from 'trading-signals';

// MACD expects indicator instances, not numbers
const macd = new MACD(
  new EMA(12), // short
  new EMA(26), // long
  new EMA(9)   // signal
);

for (const price of prices) {
  macd.add(price);
}

const result = macd.getResult();
console.log('MACD:', result?.macd);
console.log('Signal:', result?.signal);
console.log('Histogram:', result?.histogram);`,
      inputValues: [
        20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45,
      ],
      calculate: values => {
        const macd = new MACD(new EMA(12), new EMA(26), new EMA(9));
        const allResults: Array<{value: number; result: string | null}> = [];

        for (const value of values) {
          macd.add(value);
          let result = null;
          if (macd.isStable) {
            const res = macd.getResultOrThrow();
            result = `MACD: ${res.macd.toFixed(2)}, Signal: ${res.signal.toFixed(2)}`;
          }
          allResults.push({value, result});
        }

        const finalResult = macd.isStable ? macd.getResultOrThrow() : null;
        return {
          result: finalResult
            ? `MACD: ${finalResult.macd.toFixed(2)}, Signal: ${finalResult.signal.toFixed(2)}, Hist: ${finalResult.histogram.toFixed(2)}`
            : null,
          allResults,
        };
      },
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-white mb-4">Trend Indicators</h1>
        <p className="text-slate-300 text-lg">
          Trend indicators help identify the direction of price movements - whether the market is in an uptrend,
          downtrend, or moving sideways. These indicators smooth out price data to help traders spot the overall trend.
        </p>
      </div>

      <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-blue-400 mb-3">💡 How to use these examples</h2>
        <ul className="text-slate-300 space-y-2 list-disc list-inside">
          <li>Each example shows real code you can copy and use</li>
          <li>Try the interactive demo by adding your own values to see how the indicator responds</li>
          <li>Values marked with "—" indicate not enough data has been provided yet (indicator not stable)</li>
          <li>Click "Reset" to restore the default example values</li>
        </ul>
      </div>

      <div className="space-y-6">
        {examples.map((example, idx) => (
          <IndicatorDemo key={idx} example={example} />
        ))}
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <h2 className="text-2xl font-semibold text-white mb-4">Other Trend Indicators</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {[
            {name: 'ADX', desc: 'Average Directional Index - measures trend strength'},
            {name: 'PSAR', desc: 'Parabolic SAR - identifies potential reversal points'},
            {name: 'VWAP', desc: 'Volume Weighted Average Price - average price weighted by volume'},
            {name: 'DMA', desc: 'Dual Moving Average - compares two moving averages'},
            {
              name: 'RMA',
              desc: "Relative Moving Average - smoothed moving average (Wilder's method)",
            },
            {name: 'WSMA', desc: "Wilder's Smoothed Moving Average"},
            {name: 'DX', desc: 'Directional Movement Index'},
          ].map(indicator => (
            <div key={indicator.name} className="bg-slate-900/50 rounded p-4">
              <code className="text-blue-400 font-mono font-semibold">{indicator.name}</code>
              <p className="text-slate-400 text-sm mt-1">{indicator.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
