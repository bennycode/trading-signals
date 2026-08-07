import {getAverage} from 'trading-signals';
import type {UtilityConfig} from './types';

export const getAverageDemo: UtilityConfig = {
  calculate: values => {
    const result = values.length > 0 ? getAverage(values).toFixed(2) : null;
    const allResults = values.map((value, idx) => ({
      result: getAverage(values.slice(0, idx + 1)).toFixed(2),
      value,
    }));

    return {allResults, result};
  },
  code: `import { getAverage } from 'trading-signals';

const values = [10, 20, 30, 40, 50];
const avg = getAverage(values);

console.log(avg); // 30`,
  description: 'Calculates the arithmetic mean of a set of values',
  id: 'average',
  inputValues: [10, 20, 30, 40, 50],
  kind: 'demo',
  name: 'Average / Mean',
};
