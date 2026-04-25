import {CMF as CMFClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const CMF: IndicatorConfig = {
  chartTitle: 'Chaikin Money Flow (20)',
  color: '#ec4899',
  createIndicator: () => new CMFClass(20),
  description: 'Chaikin Money Flow',
  details:
    'Measures buying and selling pressure over a period. Oscillates between -1 and +1. Values above 0 indicate accumulation (buying pressure), below 0 indicate distribution (selling pressure).',
  getTableColumns: indicator => buildTableColumns({inputs: ['close', 'volume'], indicator}),
  id: 'cmf',
  name: 'CMF',
  processData: makeProcessData({rowInputs: ['close', 'volume'], addInputs: ['close', 'high', 'low', 'volume']}),
  requiredInputs: 20,
  type: 'single',
  yAxisLabel: 'CMF',
};
