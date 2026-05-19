import {getPercentageChange} from 'trading-signals';
import type {UtilityCalculatorConfig} from './types';

export const getPercentageChangeDemo: UtilityCalculatorConfig = {
  kind: 'calculator',
  id: 'percentage-change',
  name: 'Percentage Change',
  description: 'Calculate the percentage change between a starting and a final value.',
  inputs: [
    {label: 'Starting Value', defaultValue: '100'},
    {label: 'Final Value', defaultValue: '150'},
  ],
  outputLabel: 'Percentage Change',
  outputSuffix: '%',
  calculate: (from, to) => getPercentageChange(from, to),
  code: `import { getPercentageChange } from 'trading-signals';

// Price moved from 100 to 150 → +50%
const change = getPercentageChange(100, 150);

console.log(change); // 50`,
};
