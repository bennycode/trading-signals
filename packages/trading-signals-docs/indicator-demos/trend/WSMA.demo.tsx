import {WSMA as WSMAClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const WSMA: IndicatorConfig = {
  chartTitle: 'WSMA (5)',
  color: '#06b6d4',
  createIndicator: () => new WSMAClass(5),
  description: "Wilder's Smoothed Moving Average",
  details:
    'Similar to RMA, this is a smoothed moving average that reduces noise and provides a clearer view of the trend.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'wsma',
  name: 'WSMA',
  processData: makeProcessData({rowInputs: ['close']}),
  requiredInputs: 5,
  type: 'single',
  yAxisLabel: 'Price',
};
