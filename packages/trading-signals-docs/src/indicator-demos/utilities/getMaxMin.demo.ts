import {getMaximum, getMinimum} from 'trading-signals';
import type {UtilityConfig} from './types';

export const getMaxMinDemo: UtilityConfig = {
  calculate: values => {
    if (values.length === 0) {
      return {allResults: [], result: null};
    }
    const max = getMaximum(values);
    const min = getMinimum(values);
    const result = `Max: ${max}, Min: ${min}`;
    const allResults = values.map((value, idx) => {
      const subset = values.slice(0, idx + 1);
      return {
        result: `Max: ${getMaximum(subset)}, Min: ${getMinimum(subset)}`,
        value,
      };
    });

    return {allResults, result};
  },
  code: `import { getMaximum, getMinimum } from 'trading-signals';

const values = [25, 50, 75, 100, 125];

console.log(getMaximum(values)); // 125
console.log(getMinimum(values)); // 25`,
  description: 'Finds the highest and lowest values in a dataset',
  id: 'max-min',
  inputValues: [25, 50, 75, 100, 125, 150],
  kind: 'demo',
  name: 'Maximum & Minimum',
};
