import {getShare} from 'trading-signals';
import type {UtilityCalculatorConfig} from './types';

export const getShareDemo: UtilityCalculatorConfig = {
  kind: 'calculator',
  id: 'share',
  name: 'Share of Total',
  description: 'Calculate what percentage your share represents of a total.',
  inputs: [
    {label: 'Your Share', defaultValue: '40'},
    {label: 'Total', defaultValue: '100'},
  ],
  outputLabel: 'Your Share',
  outputSuffix: '%',
  calculate: (share, total) => getShare(share, total),
  code: `import { getShare } from 'trading-signals';

// 40 out of 100 → 40%
const share = getShare(40, 100);

console.log(share); // 40`,
};
