import {RMA as RMAClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const RMA: IndicatorConfig = {
  id: 'rma',
  name: 'RMA',
  description: "Relative Moving Average (Wilder's MA)",
  color: '#f59e0b',
  type: 'single',
  requiredInputs: 5,
  details:
    'Developed by J. Welles Wilder Jr., this smoothed moving average gives more weight to historical data, resulting in a smoother line.',
  createIndicator: () => new RMAClass(5),
  processData: makeProcessData({rowInputs: ['close'], signal: 'optional'}),
  getTableColumns: () => buildTableColumns({inputs: ['close']}),
  chartTitle: 'RMA (5)',
  yAxisLabel: 'Price',
};
