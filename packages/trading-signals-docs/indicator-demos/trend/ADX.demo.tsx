import {ADX as ADXClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const ADX: IndicatorConfig = {
  id: 'adx',
  name: 'ADX',
  description: 'Average Directional Index',
  color: '#a855f7',
  type: 'single',
  requiredInputs: 14,
  details:
    'Measures trend strength regardless of direction. Values above 25 indicate a strong trend, below 20 suggest a weak trend.',
  createIndicator: () => new ADXClass(14),
  processData: makeProcessData({rowInputs: ['high', 'low', 'close']}),
  getTableColumns: indicator => buildTableColumns({inputs: ['high', 'low', 'close'], indicator}),
  chartTitle: 'ADX (14)',
  yAxisLabel: 'ADX',
};
