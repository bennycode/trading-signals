import {RMA as RMAClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const RMA: IndicatorConfig = {
  chartTitle: 'RMA (5)',
  color: '#f59e0b',
  createIndicator: () => new RMAClass(5),
  description: "Relative Moving Average (Wilder's MA)",
  details:
    'Developed by J. Welles Wilder Jr., this smoothed moving average gives more weight to historical data, resulting in a smoother line.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'rma',
  name: 'RMA',
  processData: makeProcessData({rowInputs: ['close']}),
  requiredInputs: 5,
  type: 'single',
  yAxisLabel: 'Price',
};
