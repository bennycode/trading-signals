import {getMaximum, getMinimum} from 'trading-signals';
import type {UtilityConfig} from './types';

export const getMaxMinDemo: UtilityConfig = {
  kind: 'demo',
  id: 'max-min',
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
};
