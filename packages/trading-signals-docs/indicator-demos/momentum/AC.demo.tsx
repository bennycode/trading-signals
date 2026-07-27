import {AC as ACClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const AC: IndicatorConfig = {
  chartTitle: 'Accelerator Oscillator (5,34,5)',
  color: '#6366f1',
  createIndicator: () => new ACClass(5, 34, 5),
  description: 'Accelerator Oscillator',
  details:
    'Shows acceleration or deceleration of the current driving force. Earlier signal of potential trend change than AO.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['high', 'low']}),
  id: 'ac',
  name: 'AC',
  processData: makeProcessData({rowInputs: ['high', 'low']}),
  requiredInputs: 39,
  type: 'single',
  yAxisLabel: 'AC',
};
