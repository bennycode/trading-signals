import {ZLEMA as ZLEMAClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const ZLEMA: IndicatorConfig = {
  chartTitle: 'ZLEMA (5)',
  color: '#6366f1',
  createIndicator: () => new ZLEMAClass(5),
  description: 'Zero-Lag Exponential Moving Average',
  details:
    'Cancels most of the EMA lag by amplifying the newest price with its gain over the price from half an interval ago before smoothing. Hugs turning points that a plain EMA reaches several bars later.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'zlema',
  name: 'ZLEMA',
  processData: makeProcessData({rowInputs: ['close']}),
  requiredInputs: 5,
  type: 'single',
  yAxisLabel: 'Price',
};
