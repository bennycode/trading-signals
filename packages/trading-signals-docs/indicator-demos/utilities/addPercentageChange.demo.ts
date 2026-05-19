import {addPercentageChange} from 'trading-signals';
import type {UtilityCalculatorConfig} from './types';

export const addPercentageChangeDemo: UtilityCalculatorConfig = {
  kind: 'calculator',
  id: 'add-percentage-change',
  name: 'Add Percentage Change',
  description: 'Apply a percentage change to a starting value to get the final value.',
  inputs: [
    {label: 'Starting Value', defaultValue: '100'},
    {label: 'Percentage Change (%)', defaultValue: '50'},
  ],
  outputLabel: 'Final Value',
  calculate: (from, percentage) => addPercentageChange(from, percentage),
  code: `import { addPercentageChange } from 'trading-signals';

// Apply a 50% gain to a starting value of 100
const target = addPercentageChange(100, 50);

console.log(target); // 150`,
};
