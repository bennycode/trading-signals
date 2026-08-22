import {ER as ERClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const ER: IndicatorConfig = {
  chartTitle: 'Range Efficiency (14)',
  color: '#f59e0b',
  createIndicator: () => new ERClass(14),
  description: 'Range Efficiency',
  details:
    'Measures how much of the price range was directional movement versus noise. Returns a value between 0 and 1 — near 0 means choppy/range-bound, near 1 means strongly trending. Formula: |close_now − close_N_ago| / (highest_high − lowest_low).',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'er',
  name: 'ER',
  processData: makeProcessData({addInputs: ['high', 'low', 'close'], rowInputs: ['close']}),
  requiredInputs: 14,
  type: 'single',
  yAxisLabel: 'ER',
};
