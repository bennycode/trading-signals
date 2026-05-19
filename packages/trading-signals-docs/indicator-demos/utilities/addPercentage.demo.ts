import {addPercentage} from 'trading-signals';
import type {UtilityCalculatorConfig} from './types';

export const addPercentageDemo: UtilityCalculatorConfig = {
  kind: 'calculator',
  id: 'add-percentage',
  name: 'Add Percentage',
  description: 'Apply a percentage change to a starting value to get the final value.',
  inputs: [
    {label: 'Starting Value', defaultValue: '100'},
    {label: 'Percentage Change (%)', defaultValue: '50'},
  ],
  outputLabel: 'Final Value',
  calculate: (from, percentage) => addPercentage(from, percentage),
  code: `import { addPercentage } from 'trading-signals';

// Apply a 50% gain to a starting value of 100
const target = addPercentage(100, 50);

console.log(target); // 150`,
};
