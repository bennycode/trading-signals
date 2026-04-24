import {SMA as SMAClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const SMA: IndicatorConfig = {
  id: 'sma',
  name: 'SMA',
  description: 'Simple Moving Average',
  color: '#3b82f6',
  type: 'single',
  requiredInputs: 5,
  details:
    'Calculates the arithmetic mean of prices over a specified period. Smooths out price fluctuations to identify the trend direction.',
  createIndicator: () => new SMAClass(5),
  processData: makeProcessData({rowInputs: ['close'], signal: 'optional'}),
  getTableColumns: () => buildTableColumns({inputs: ['close']}),
  chartTitle: 'SMA (5)',
  yAxisLabel: 'Price',
};
