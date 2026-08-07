import {WMA as WMAClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const WMA: IndicatorConfig = {
  chartTitle: 'WMA (5)',
  color: '#10b981',
  createIndicator: () => new WMAClass(5),
  description: 'Weighted Moving Average',
  details: 'Assigns linearly increasing weights to recent data points. The most recent price has the highest weight.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'wma',
  name: 'WMA',
  processData: makeProcessData({rowInputs: ['close']}),
  requiredInputs: 5,
  type: 'single',
  yAxisLabel: 'Price',
};
