import {OBV as OBVClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const OBV: IndicatorConfig = {
  id: 'obv',
  name: 'OBV',
  description: 'On-Balance Volume',
  color: '#14b8a6',
  type: 'single',
  requiredInputs: 1,
  details: 'Cumulative volume-based indicator. Rising OBV with rising prices confirms uptrend.',
  createIndicator: () => new OBVClass(5),
  processData: makeProcessData({rowInputs: ['close', 'volume'], alwaysStable: true}),
  getTableColumns: indicator => buildTableColumns({inputs: ['close', 'volume'], indicator}),
  chartTitle: 'On-Balance Volume (5)',
  yAxisLabel: 'OBV',
};
