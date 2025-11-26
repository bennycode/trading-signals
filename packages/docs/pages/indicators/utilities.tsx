import {getAverage, getMedian, getStandardDeviation, getMaximum, getMinimum} from 'trading-signals';
import IndicatorDemo, {IndicatorExample} from '../../components/IndicatorDemo';

export default function UtilityFunctions() {
  const examples: IndicatorExample[] = [
    {
      name: 'Average / Mean',
      description: 'Calculates the arithmetic mean of a set of values',
      code: `import { getAverage } from 'trading-signals';

const values = [10, 20, 30, 40, 50];
const avg = getAverage(values);

console.log(avg); // 30`,
      inputValues: [10, 20, 30, 40, 50],
      calculate: values => {
        const result = values.length > 0 ? getAverage(values).toFixed(2) : null;
        const allResults = values.map((value, idx) => ({
          value,
          result: getAverage(values.slice(0, idx + 1)).toFixed(2),
        }));

        return {result, allResults};
      },
    },
    {
      name: 'Median',
      description: 'Finds the middle value in a sorted dataset',
      code: `import { getMedian } from 'trading-signals';

const values = [7, 31, 47, 75, 87];
const median = getMedian(values);

console.log(median); // 47`,
      inputValues: [7, 31, 47, 75, 87, 115, 119],
      calculate: values => {
        const result = values.length > 0 ? getMedian(values).toFixed(2) : null;
        const allResults = values.map((value, idx) => ({
          value,
          result: getMedian(values.slice(0, idx + 1)).toFixed(2),
        }));

        return {result, allResults};
      },
    },
    {
      name: 'Standard Deviation',
      description: 'Measures the amount of variation or dispersion in a dataset',
      code: `import { getStandardDeviation } from 'trading-signals';

const values = [10, 12, 14, 16, 18];
const stdDev = getStandardDeviation(values);

console.log(stdDev);`,
      inputValues: [10, 12, 14, 16, 18, 20, 22],
      calculate: values => {
        if (values.length < 2) {
          return {
            result: null,
            allResults: values.map(value => ({value, result: null})),
          };
        }
        const result = getStandardDeviation(values).toFixed(2);
        const allResults = values.map((value, idx) => ({
          value,
          result: idx > 0 ? getStandardDeviation(values.slice(0, idx + 1)).toFixed(2) : null,
        }));

        return {result, allResults};
      },
    },
    {
      name: 'Maximum & Minimum',
      description: 'Finds the highest and lowest values in a dataset',
      code: `import { getMaximum, getMinimum } from 'trading-signals';

const values = [25, 50, 75, 100, 125];

console.log(getMaximum(values)); // 125
console.log(getMinimum(values)); // 25`,
      inputValues: [25, 50, 75, 100, 125, 150],
      calculate: values => {
        if (values.length === 0) {
          return {result: null, allResults: []};
        }
        const max = getMaximum(values);
        const min = getMinimum(values);
        const result = `Max: ${max}, Min: ${min}`;

        const allResults = values.map((value, idx) => {
          const subset = values.slice(0, idx + 1);
          return {
            value,
            result: `Max: ${getMaximum(subset)}, Min: ${getMinimum(subset)}`,
          };
        });

        return {result, allResults};
      },
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-white mb-4">Utility Functions</h1>
        <p className="text-slate-300 text-lg">
          Mathematical utility functions that support technical analysis calculations. These are the building blocks
          used by many indicators and are also useful for custom analysis.
        </p>
      </div>

      <div className="bg-slate-700/20 border border-slate-600/50 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-slate-300 mb-3">🛠️ When to use utilities</h2>
        <ul className="text-slate-300 space-y-2 list-disc list-inside">
          <li>
            <strong>Average:</strong> Quick statistical summary, smoothing data, calculating returns
          </li>
          <li>
            <strong>Median:</strong> Finding the "typical" value, less sensitive to outliers than mean
          </li>
          <li>
            <strong>Standard Deviation:</strong> Measuring volatility, risk assessment, Bollinger Bands
          </li>
          <li>
            <strong>Max/Min:</strong> Finding support/resistance levels, calculating ranges
          </li>
        </ul>
      </div>

      <div className="space-y-6">
        {examples.map((example, idx) => (
          <IndicatorDemo key={idx} example={example} />
        ))}
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <h2 className="text-2xl font-semibold text-white mb-4">Other Utility Functions</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {[
            {
              name: 'getQuartile',
              desc: 'Calculates Q1, Q2 (median), and Q3 values for a dataset',
            },
            {
              name: 'getGrid',
              desc: 'Generates price grid levels for grid trading strategies',
            },
            {
              name: 'getStreaks',
              desc: 'Identifies consecutive positive/negative value sequences',
            },
            {
              name: 'getWeekday',
              desc: 'Extracts weekday information from timestamps',
            },
          ].map(func => (
            <div key={func.name} className="bg-slate-900/50 rounded p-4">
              <code className="text-slate-400 font-mono font-semibold">{func.name}</code>
              <p className="text-slate-400 text-sm mt-1">{func.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
