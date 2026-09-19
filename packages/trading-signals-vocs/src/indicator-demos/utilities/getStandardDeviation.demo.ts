import {getStandardDeviation} from 'trading-signals';
import type {UtilityConfig} from './types';

export const getStandardDeviationDemo: UtilityConfig = {
  calculate: values => {
    if (values.length < 2) {
      return {
        allResults: values.map(value => ({result: null, value})),
        result: null,
      };
    }
    const result = getStandardDeviation(values).toFixed(2);
    const allResults = values.map((value, idx) => ({
      result: idx > 0 ? getStandardDeviation(values.slice(0, idx + 1)).toFixed(2) : null,
      value,
    }));

    return {allResults, result};
  },
  code: `import { getStandardDeviation } from 'trading-signals';

const values = [10, 12, 14, 16, 18];
const stdDev = getStandardDeviation(values);

console.log(stdDev);`,
  description: 'Measures the amount of variation or dispersion in a dataset',
  id: 'standard-deviation',
  inputValues: [10, 12, 14, 16, 18, 20, 22],
  kind: 'demo',
  name: 'Standard Deviation',
};
