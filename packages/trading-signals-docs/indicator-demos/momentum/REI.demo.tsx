import {REI as REIClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const REI: IndicatorConfig = {
  chartTitle: 'Range Expansion Index (5)',
  color: '#a855f7',
  createIndicator: () => new REIClass(5),
  description: 'Range Expansion Index',
  details: 'Measures range expansion to identify potential breakouts.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'rei',
  name: 'REI',
  processData: makeProcessData({addInputs: ['high', 'low', 'close', 'open'], rowInputs: ['close']}),
  requiredInputs: 5,
  type: 'single',
  yAxisLabel: 'REI',
};
