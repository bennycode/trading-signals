import {DEMA as DEMAClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const DEMA: IndicatorConfig = {
  id: 'dema',
  name: 'DEMA',
  description: 'Double Exponential Moving Average',
  color: '#ec4899',
  type: 'single',
  requiredInputs: 9,
  details: 'Reduces lag by applying EMA twice, providing faster signals than standard EMA while maintaining smoothness.',
  createIndicator: () => new DEMAClass(5),
  processData: makeProcessData({rowInputs: ['close']}),
  getTableColumns: indicator => buildTableColumns({inputs: ['close'], indicator}),
  chartTitle: 'DEMA (5)',
  yAxisLabel: 'Price',
};
