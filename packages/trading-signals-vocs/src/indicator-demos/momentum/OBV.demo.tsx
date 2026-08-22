import {OBV as OBVClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const OBV: IndicatorConfig = {
  chartTitle: 'On-Balance Volume (5)',
  color: '#14b8a6',
  createIndicator: () => new OBVClass(5),
  description: 'On-Balance Volume',
  details: 'Cumulative volume-based indicator. Rising OBV with rising prices confirms uptrend.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close', 'volume']}),
  id: 'obv',
  name: 'OBV',
  processData: makeProcessData({alwaysStable: true, rowInputs: ['close', 'volume']}),
  requiredInputs: 1,
  type: 'single',
  yAxisLabel: 'OBV',
};
