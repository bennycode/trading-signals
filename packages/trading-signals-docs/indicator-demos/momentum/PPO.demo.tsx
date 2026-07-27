import {PPO as PPOClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const PPO: IndicatorConfig = {
  chartTitle: 'PPO (12, 26)',
  color: '#06b6d4',
  createIndicator: () => new PPOClass(),
  description: 'Percentage Price Oscillator',
  details:
    "The MACD's percentage sibling: divides the spread between the fast and slow EMA by the slow EMA, making momentum readings comparable across differently priced instruments. Crossings of the zero line signal trend changes.",
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'ppo',
  name: 'PPO',
  processData: makeProcessData({rowInputs: ['close']}),
  requiredInputs: 26,
  type: 'single',
  yAxisLabel: 'PPO (%)',
};
