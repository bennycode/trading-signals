import {REI as REIClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const REI: IndicatorConfig = {
  id: 'rei',
  name: 'REI',
  description: 'Range Expansion Index',
  color: '#a855f7',
  type: 'single',
  requiredInputs: 5,
  details: 'Measures range expansion to identify potential breakouts.',
  createIndicator: () => new REIClass(5),
  processData: makeProcessData({rowInputs: ['close'], addInputs: ['high', 'low', 'close', 'open']}),
  getTableColumns: indicator => buildTableColumns({inputs: ['close'], indicator}),
  chartTitle: 'Range Expansion Index (5)',
  yAxisLabel: 'REI',
};
