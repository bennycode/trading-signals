import {EMA as EMAClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const EMA: IndicatorConfig = {
  id: 'ema',
  name: 'EMA',
  description: 'Exponential Moving Average',
  color: '#8b5cf6',
  type: 'single',
  requiredInputs: 5,
  details:
    'Gives more weight to recent prices, reacting faster to price changes than SMA. Popular for identifying short-term trends.',
  createIndicator: () => new EMAClass(5),
  processData: makeProcessData({rowInputs: ['close'], signal: 'optional'}),
  getTableColumns: () => buildTableColumns({inputs: ['close']}),
  chartTitle: 'EMA (5)',
  yAxisLabel: 'Price',
};
