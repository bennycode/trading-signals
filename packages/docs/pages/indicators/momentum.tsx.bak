import {RSI, StochasticOscillator, CCI, ROC} from 'trading-signals';
import IndicatorDemo, {IndicatorExample} from '../../components/IndicatorDemo';

export default function MomentumIndicators() {
  const examples: IndicatorExample[] = [
    {
      name: 'Relative Strength Index (RSI)',
      description: 'Measures the magnitude of recent price changes (0-100 scale)',
      code: `import { RSI } from 'trading-signals';

const rsi = new RSI(14);

// Add price values
rsi.add(44);
rsi.add(45);
// ... add more values

console.log(rsi.getResult());`,
      inputValues: [44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58],
      calculate: values => {
        const rsi = new RSI(14);
        const allResults: Array<{value: number; result: string | null}> = [];

        for (const value of values) {
          rsi.add(value);
          const result = rsi.isStable ? rsi.getResult().toFixed(2) : null;
          allResults.push({value, result});
        }

        return {
          result: rsi.isStable ? rsi.getResult().toFixed(2) : null,
          allResults,
        };
      },
    },
    {
      name: 'Stochastic Oscillator',
      description: 'Compares closing price to price range over a given period',
      code: `import { StochasticOscillator } from 'trading-signals';

// StochasticOscillator expects (n, m, p)
// n = %K period, m = %K slowing, p = %D period
const stoch = new StochasticOscillator(14, 3, 3);

stoch.add({
  high: 50,
  low: 40,
  close: 45
});

const result = stoch.getResult();
console.log('%K:', result.stochK);
console.log('%D:', result.stochD);`,
      inputValues: [45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60],
      calculate: values => {
        const stoch = new StochasticOscillator(14, 3, 3);
        const allResults: Array<{value: number; result: string | null}> = [];

        for (const value of values) {
          stoch.add({
            high: value + 5,
            low: value - 5,
            close: value,
          });
          let result = null;
          if (stoch.isStable) {
            const res = stoch.getResultOrThrow();
            result = `%K: ${res.stochK.toFixed(2)}, %D: ${res.stochD.toFixed(2)}`;
          }
          allResults.push({value, result});
        }

        const finalResult = stoch.isStable ? stoch.getResultOrThrow() : null;
        return {
          result: finalResult ? `%K: ${finalResult.stochK.toFixed(2)}, %D: ${finalResult.stochD.toFixed(2)}` : null,
          allResults,
        };
      },
    },
    {
      name: 'Commodity Channel Index (CCI)',
      description: 'Measures deviation from the average price',
      code: `import { CCI } from 'trading-signals';

const cci = new CCI(20);

cci.add({
  high: 52,
  low: 48,
  close: 50
});

console.log(cci.getResult());`,
      inputValues: [50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70],
      calculate: values => {
        const cci = new CCI(20);
        const allResults: Array<{value: number; result: string | null}> = [];

        for (const value of values) {
          cci.add({
            high: value + 2,
            low: value - 2,
            close: value,
          });
          const result = cci.isStable ? cci.getResultOrThrow().toFixed(2) : null;
          allResults.push({value, result});
        }

        return {
          result: cci.isStable ? cci.getResultOrThrow().toFixed(2) : null,
          allResults,
        };
      },
    },
    {
      name: 'Rate of Change (ROC)',
      description: 'Measures the percentage change in price from n periods ago',
      code: `import { ROC } from 'trading-signals';

const roc = new ROC(9);

roc.add(100);
roc.add(102);
roc.add(105);
// ... add more values

console.log(roc.getResult());`,
      inputValues: [100, 102, 105, 107, 110, 108, 106, 109, 112, 115],
      calculate: values => {
        const roc = new ROC(9);
        const allResults: Array<{value: number; result: string | null}> = [];

        for (const value of values) {
          roc.add(value);
          const result = roc.isStable ? roc.getResultOrThrow().toFixed(2) : null;
          allResults.push({value, result});
        }

        return {
          result: roc.isStable ? roc.getResultOrThrow().toFixed(2) : null,
          allResults,
        };
      },
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-white mb-4">Momentum Indicators</h1>
        <p className="text-slate-300 text-lg">
          Momentum indicators measure the speed and strength of price movements. They help identify overbought or
          oversold conditions and potential trend reversals.
        </p>
      </div>

      <div className="bg-purple-900/20 border border-purple-800/50 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-purple-400 mb-3">📊 Common Interpretations</h2>
        <ul className="text-slate-300 space-y-2 list-disc list-inside">
          <li>
            <strong>RSI:</strong> Values above 70 indicate overbought, below 30 indicate oversold
          </li>
          <li>
            <strong>Stochastic:</strong> %K crossing above %D can signal a buying opportunity
          </li>
          <li>
            <strong>CCI:</strong> Readings above +100 suggest overbought, below -100 suggest oversold
          </li>
          <li>
            <strong>ROC:</strong> Positive values indicate upward momentum, negative values indicate downward momentum
          </li>
        </ul>
      </div>

      <div className="space-y-6">
        {examples.map((example, idx) => (
          <IndicatorDemo key={idx} example={example} />
        ))}
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <h2 className="text-2xl font-semibold text-white mb-4">Other Momentum Indicators</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {[
            {name: 'AO', desc: 'Awesome Oscillator - measures market momentum'},
            {name: 'AC', desc: 'Accelerator Oscillator - measures acceleration/deceleration'},
            {name: 'CG', desc: 'Center of Gravity - identifies turning points'},
            {name: 'MOM', desc: 'Momentum - simple momentum calculation'},
            {name: 'OBV', desc: 'On-Balance Volume - volume-based momentum'},
            {name: 'REI', desc: 'Range Expansion Index - measures range expansion'},
            {name: 'STOCHRSI', desc: 'Stochastic RSI - applies Stochastic to RSI values'},
          ].map(indicator => (
            <div key={indicator.name} className="bg-slate-900/50 rounded p-4">
              <code className="text-purple-400 font-mono font-semibold">{indicator.name}</code>
              <p className="text-slate-400 text-sm mt-1">{indicator.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
