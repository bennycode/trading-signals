import {addPercentageChange} from 'trading-signals';
import type {UtilityCalculatorConfig} from './types';

export const addPercentageChangeDemo: UtilityCalculatorConfig = {
  calculate: (from, percentage) => addPercentageChange(from, percentage),
  code: `import { addPercentageChange } from 'trading-signals';

// Apply a 50% gain to a starting value of 100
const target = addPercentageChange(100, 50);

console.log(target); // 150`,
  description: 'Apply a percentage change to a starting value to get the final value.',
  id: 'add-percentage-change',
  inputs: [
    {defaultValue: '100', label: 'Starting Value'},
    {defaultValue: '50', label: 'Percentage Change (%)'},
  ],
  kind: 'calculator',
  name: 'Add Percentage Change',
  outputLabel: 'Final Value',
};
