import {SMA15 as SMA15Class} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const SMA15: IndicatorConfig = {
  id: 'sma15',
  name: 'SMA15',
  description: "Spencer's 15-Point Moving Average",
  color: '#14b8a6',
  type: 'single',
  requiredInputs: 15,
  details:
    'A specialized 15-point weighted moving average using Spencer’s fixed weights, designed to preserve trend while filtering seasonal and irregular variations.',
  createIndicator: () => new SMA15Class(15),
  processData: makeProcessData({rowInputs: ['close']}),
  getTableColumns: indicator => buildTableColumns({inputs: ['close'], indicator}),
  chartTitle: "Spencer's 15-Point MA",
  yAxisLabel: 'Price',
};
