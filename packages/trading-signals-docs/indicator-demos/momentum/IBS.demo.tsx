import {IBS as IBSClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const IBS: IndicatorConfig = {
  chartTitle: 'Internal Bar Strength',
  color: '#fb7185',
  createIndicator: () => new IBSClass(),
  description: 'Internal Bar Strength',
  details:
    'Locates each close within its candle range on a scale from 0 (close at the low) to 1 (close at the high). A mean-reversion primitive: values of 0.8 or above indicate overbought, 0.2 or below indicate oversold.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['high', 'low', 'close']}),
  id: 'ibs',
  name: 'IBS',
  processData: makeProcessData({rowInputs: ['high', 'low', 'close']}),
  requiredInputs: 1,
  type: 'single',
  yAxisLabel: 'IBS',
};
