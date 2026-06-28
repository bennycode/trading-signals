import {SMA15 as SMA15Class} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const SMA15: IndicatorConfig = {
  chartTitle: "Spencer's 15-Point MA",
  color: '#14b8a6',
  createIndicator: () => new SMA15Class(15),
  description: "Spencer's 15-Point Moving Average",
  details:
    'A specialized 15-point weighted moving average using Spencer’s fixed weights, designed to preserve trend while filtering seasonal and irregular variations.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'sma15',
  name: 'SMA15',
  processData: makeProcessData({rowInputs: ['close']}),
  requiredInputs: 15,
  type: 'single',
  yAxisLabel: 'Price',
};
