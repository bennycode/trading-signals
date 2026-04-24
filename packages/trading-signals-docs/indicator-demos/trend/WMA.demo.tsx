import {WMA as WMAClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const WMA: IndicatorConfig = {
  id: 'wma',
  name: 'WMA',
  description: 'Weighted Moving Average',
  color: '#10b981',
  type: 'single',
  requiredInputs: 5,
  details: 'Assigns linearly increasing weights to recent data points. The most recent price has the highest weight.',
  createIndicator: () => new WMAClass(5),
  processData: makeProcessData({rowInputs: ['close'], signal: 'optional'}),
  getTableColumns: () => buildTableColumns({inputs: ['close']}),
  chartTitle: 'WMA (5)',
  yAxisLabel: 'Price',
};
