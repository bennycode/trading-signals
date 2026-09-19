import {getMedian} from 'trading-signals';
import type {UtilityConfig} from './types';

export const getMedianDemo: UtilityConfig = {
  calculate: values => {
    // getMedian expects sorted input; sort copies so the history keeps the order values were added in.
    const sorted = (list: number[]) => [...list].sort((a, b) => a - b);
    const result = values.length > 0 ? getMedian(sorted(values)).toFixed(2) : null;
    const allResults = values.map((value, idx) => ({
      result: getMedian(sorted(values.slice(0, idx + 1))).toFixed(2),
      value,
    }));

    return {allResults, result};
  },
  code: `import { getMedian } from 'trading-signals';

const values = [7, 31, 47, 75, 87];
const median = getMedian(values);

console.log(median); // 47`,
  description: 'Finds the middle value in a sorted dataset',
  id: 'median',
  inputValues: [7, 31, 47, 75, 87, 115, 119],
  kind: 'demo',
  name: 'Median',
};
