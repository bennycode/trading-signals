import {getPercentageChange} from 'trading-signals';
import type {UtilityCalculatorConfig} from './types';

export const getPercentageChangeDemo: UtilityCalculatorConfig = {
  calculate: (from, to) => getPercentageChange(from, to),
  code: `import { getPercentageChange } from 'trading-signals';

// Price moved from 100 to 150 → +50%
const change = getPercentageChange(100, 150);

console.log(change); // 50`,
  description: 'Calculate the percentage change between a starting and a final value.',
  id: 'percentage-change',
  inputs: [
    {defaultValue: '100', label: 'Starting Value'},
    {defaultValue: '150', label: 'Final Value'},
  ],
  kind: 'calculator',
  name: 'Percentage Change',
  outputLabel: 'Percentage Change',
  outputSuffix: '%',
};
