import {BollingerBands, ATR, IQR} from 'trading-signals';
import IndicatorDemo, {IndicatorExample} from '../../components/IndicatorDemo';

export default function VolatilityIndicators() {
  const examples: IndicatorExample[] = [
    {
      name: 'Bollinger Bands (BBANDS)',
      description: 'Shows price volatility using standard deviations from a moving average',
      code: `import { BollingerBands } from 'trading-signals';

const bb = new BollingerBands(20, 2);

const prices = [
  50, 51, 52, 51, 50, 49, 50, 51, 52,
  53, 54, 53, 52, 51, 50, 49, 50, 51,
  52, 53, 54,
];

prices.forEach((p) => bb.add(p));

// After enough values, you can read the result
const { upper, middle, lower } = bb.getResultOrThrow();
console.log('Upper:', upper);
console.log('Middle:', middle);
console.log('Lower:', lower);`,
      inputValues: [50, 51, 52, 51, 50, 49, 50, 51, 52, 53, 54, 53, 52, 51, 50, 49, 50, 51, 52, 53, 54],
      calculate: values => {
        const bb = new BollingerBands(20, 2);
        const allResults: Array<{value: number; result: string | null}> = [];

        for (const value of values) {
          bb.add(value);
          let result = null;
          if (bb.isStable) {
            const res = bb.getResultOrThrow();
            result = `U: ${res.upper.toFixed(2)}, M: ${res.middle.toFixed(2)}, L: ${res.lower.toFixed(2)}`;
          }
          allResults.push({value, result});
        }

        const finalResult = bb.isStable ? bb.getResultOrThrow() : null;
        return {
          result: finalResult
            ? `Upper: ${finalResult.upper.toFixed(2)}, Mid: ${finalResult.middle.toFixed(2)}, Lower: ${finalResult.lower.toFixed(2)}`
            : null,
          allResults,
        };
      },
    },
    {
      name: 'Average True Range (ATR)',
      description: 'Measures market volatility by analyzing the range of price movements',
      code: `import { ATR } from 'trading-signals';

const atr = new ATR(14);

atr.add({
  high: 55,
  low: 45,
  close: 50
});

console.log(atr.getResult());`,
      inputValues: [50, 51, 52, 51, 50, 49, 48, 49, 50, 51, 52, 53, 54, 53, 52],
      calculate: values => {
        const atr = new ATR(14);
        const allResults: Array<{value: number; result: string | null}> = [];

        for (const value of values) {
          atr.add({
            high: value + 3,
            low: value - 3,
            close: value,
          });
          const result = atr.isStable ? atr.getResultOrThrow().toFixed(2) : null;
          allResults.push({value, result});
        }

        return {
          result: atr.isStable ? atr.getResultOrThrow().toFixed(2) : null,
          allResults,
        };
      },
    },
    {
      name: 'Interquartile Range (IQR)',
      description: 'Statistical measure of variability, showing the middle 50% of data',
      code: `import { IQR } from 'trading-signals';

const iqr = new IQR(13);

const prices = [
  7, 7, 31, 31, 47, 75, 87,
  115, 116, 119, 119, 155, 177
];

for (const price of prices) {
  iqr.add(price);
}

console.log(iqr.getResultOrThrow()); // 88`,
      inputValues: [7, 7, 31, 31, 47, 75, 87, 115, 116, 119, 119, 155, 177],
      calculate: values => {
        const iqr = new IQR(13);
        const allResults: Array<{value: number; result: string | null}> = [];

        for (const value of values) {
          iqr.add(value);
          const result = iqr.isStable ? iqr.getResultOrThrow().toFixed(2) : null;
          allResults.push({value, result});
        }

        return {
          result: iqr.isStable ? iqr.getResultOrThrow().toFixed(2) : null,
          allResults,
        };
      },
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-white mb-4">Volatility Indicators</h1>
        <p className="text-slate-300 text-lg">
          Volatility indicators measure the degree of price variation over time. Higher volatility indicates larger
          price swings, while lower volatility suggests more stable prices.
        </p>
      </div>

      <div className="bg-orange-900/20 border border-orange-800/50 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-orange-400 mb-3">🌊 Understanding Volatility</h2>
        <ul className="text-slate-300 space-y-2 list-disc list-inside">
          <li>
            <strong>Bollinger Bands:</strong> Price touching the upper band may indicate overbought, touching lower band
            may indicate oversold
          </li>
          <li>
            <strong>ATR:</strong> Higher values indicate higher volatility; useful for setting stop-loss levels
          </li>
          <li>
            <strong>IQR:</strong> Robust measure of spread that's less sensitive to outliers than standard deviation
          </li>
          <li>Volatility often increases during market uncertainty and decreases during calm periods</li>
        </ul>
      </div>

      <div className="space-y-6">
        {examples.map((example, idx) => (
          <IndicatorDemo key={idx} example={example} />
        ))}
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <h2 className="text-2xl font-semibold text-white mb-4">Other Volatility Indicators</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {[
            {name: 'ABANDS', desc: 'Acceleration Bands - volatility bands based on price momentum'},
            {name: 'BBW', desc: 'Bollinger Bands Width - measures the width of the bands'},
            {name: 'MAD', desc: 'Mean Absolute Deviation - average absolute deviation from mean'},
            {name: 'TR', desc: 'True Range - measures volatility of high-low-close'},
          ].map(indicator => (
            <div key={indicator.name} className="bg-slate-900/50 rounded p-4">
              <code className="text-orange-400 font-mono font-semibold">{indicator.name}</code>
              <p className="text-slate-400 text-sm mt-1">{indicator.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
