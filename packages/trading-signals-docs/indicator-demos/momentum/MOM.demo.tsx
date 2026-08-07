import {MOM as MOMClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const MOM: IndicatorConfig = {
  chartTitle: 'Momentum (5)',
  color: '#84cc16',
  createIndicator: () => new MOMClass(5),
  description: 'Momentum',
  details:
    'Momentum measures the change in price over n periods. Bullish when momentum is positive (price rising), bearish when momentum is negative (price falling).',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'mom',
  name: 'MOM',
  processData: makeProcessData({rowInputs: ['close']}),
  requiredInputs: 5,
  type: 'single',
  yAxisLabel: 'MOM',
};
