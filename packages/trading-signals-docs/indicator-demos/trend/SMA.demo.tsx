import {SMA as SMAClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const SMA: IndicatorConfig = {
  chartTitle: 'SMA (5)',
  color: '#3b82f6',
  createIndicator: () => new SMAClass(5),
  description: 'Simple Moving Average',
  details:
    'Calculates the arithmetic mean of prices over a specified period. Smooths out price fluctuations to identify the trend direction.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'sma',
  name: 'SMA',
  processData: makeProcessData({rowInputs: ['close']}),
  requiredInputs: 5,
  type: 'single',
  yAxisLabel: 'Price',
};
