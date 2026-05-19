import {getAverage} from 'trading-signals';
import type {UtilityConfig} from './types';

export const getAverageDemo: UtilityConfig = {
  kind: 'demo',
  id: 'average',
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
};
