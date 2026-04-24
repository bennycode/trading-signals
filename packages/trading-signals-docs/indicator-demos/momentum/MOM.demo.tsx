import {MOM as MOMClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const MOM: IndicatorConfig = {
  id: 'mom',
  name: 'MOM',
  description: 'Momentum',
  color: '#84cc16',
  type: 'single',
  requiredInputs: 5,
  details:
    'Momentum measures the change in price over n periods. Bullish when momentum is positive (price rising), bearish when momentum is negative (price falling).',
  createIndicator: () => new MOMClass(5),
  processData: makeProcessData({rowInputs: ['close']}),
  getTableColumns: indicator => buildTableColumns({inputs: ['close'], indicator}),
  chartTitle: 'Momentum (5)',
  yAxisLabel: 'MOM',
};
