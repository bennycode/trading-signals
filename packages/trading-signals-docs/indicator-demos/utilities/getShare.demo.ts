import {getShare} from 'trading-signals';
import type {UtilityCalculatorConfig} from './types';

export const getShareDemo: UtilityCalculatorConfig = {
  calculate: (share, total) => getShare(share, total),
  code: `import { getShare } from 'trading-signals';

// 40 out of 100 → 40%
const share = getShare(40, 100);

console.log(share); // 40`,
  description: 'Calculate what percentage your share represents of a total.',
  id: 'share',
  inputs: [
    {defaultValue: '40', label: 'Your Share'},
    {defaultValue: '100', label: 'Total'},
  ],
  kind: 'calculator',
  name: 'Share of Total',
  outputLabel: 'Your Share',
  outputSuffix: '%',
};
