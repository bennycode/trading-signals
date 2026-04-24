import {ER as ERClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const ER: IndicatorConfig = {
  id: 'er',
  name: 'ER',
  description: 'Range Efficiency',
  color: '#f59e0b',
  type: 'single',
  requiredInputs: 14,
  details:
    'Measures how much of the price range was directional movement versus noise. Returns a value between 0 and 1 — near 0 means choppy/range-bound, near 1 means strongly trending. Formula: |close_now − close_N_ago| / (highest_high − lowest_low).',
  createIndicator: () => new ERClass(14),
  processData: makeProcessData({rowInputs: ['close'], addInputs: ['high', 'low', 'close'], signal: 'required'}),
  getTableColumns: () => buildTableColumns({inputs: ['close']}),
  chartTitle: 'Range Efficiency (14)',
  yAxisLabel: 'ER',
};
