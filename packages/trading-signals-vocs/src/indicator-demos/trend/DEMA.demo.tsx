import {DEMA as DEMAClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const DEMA: IndicatorConfig = {
  chartTitle: 'DEMA (5)',
  color: '#ec4899',
  createIndicator: () => new DEMAClass(5),
  description: 'Double Exponential Moving Average',
  details:
    'Reduces lag by applying EMA twice, providing faster signals than standard EMA while maintaining smoothness.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'dema',
  name: 'DEMA',
  processData: makeProcessData({rowInputs: ['close']}),
  requiredInputs: 9,
  type: 'single',
  yAxisLabel: 'Price',
};
