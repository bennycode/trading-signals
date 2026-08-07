import {EMA as EMAClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const EMA: IndicatorConfig = {
  chartTitle: 'EMA (5)',
  color: '#8b5cf6',
  createIndicator: () => new EMAClass(5),
  description: 'Exponential Moving Average',
  details:
    'Gives more weight to recent prices, reacting faster to price changes than SMA. Popular for identifying short-term trends.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'ema',
  name: 'EMA',
  processData: makeProcessData({rowInputs: ['close']}),
  requiredInputs: 5,
  type: 'single',
  yAxisLabel: 'Price',
};
