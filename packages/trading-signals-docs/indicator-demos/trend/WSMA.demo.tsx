import {WSMA as WSMAClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const WSMA: IndicatorConfig = {
  id: 'wsma',
  name: 'WSMA',
  description: "Wilder's Smoothed Moving Average",
  color: '#06b6d4',
  type: 'single',
  requiredInputs: 5,
  details: 'Similar to RMA, this is a smoothed moving average that reduces noise and provides a clearer view of the trend.',
  createIndicator: () => new WSMAClass(5),
  processData: makeProcessData({rowInputs: ['close']}),
  getTableColumns: indicator => buildTableColumns({inputs: ['close'], indicator}),
  chartTitle: 'WSMA (5)',
  yAxisLabel: 'Price',
};
