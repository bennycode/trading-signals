import {ADX as ADXClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const ADX: IndicatorConfig = {
  chartTitle: 'ADX (14)',
  color: '#a855f7',
  createIndicator: () => new ADXClass(14),
  description: 'Average Directional Index',
  details:
    'Measures trend strength regardless of direction. Values above 25 indicate a strong trend, below 20 suggest a weak trend.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['high', 'low', 'close']}),
  id: 'adx',
  name: 'ADX',
  processData: makeProcessData({rowInputs: ['high', 'low', 'close']}),
  requiredInputs: 14,
  type: 'single',
  yAxisLabel: 'ADX',
};
