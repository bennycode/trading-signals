import {getStandardDeviation} from 'trading-signals';
import type {UtilityConfig} from './types';

export const getStandardDeviationDemo: UtilityConfig = {
  kind: 'demo',
  id: 'standard-deviation',
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
};
