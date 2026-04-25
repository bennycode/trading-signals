import {AC as ACClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const AC: IndicatorConfig = {
  id: 'ac',
  name: 'AC',
  description: 'Accelerator Oscillator',
  color: '#6366f1',
  type: 'single',
  requiredInputs: 39,
  details:
    'Shows acceleration or deceleration of the current driving force. Earlier signal of potential trend change than AO.',
  createIndicator: () => new ACClass(5, 34, 5),
  processData: makeProcessData({rowInputs: ['high', 'low']}),
  getTableColumns: indicator => buildTableColumns({inputs: ['high', 'low'], indicator}),
  chartTitle: 'Accelerator Oscillator (5,34,5)',
  yAxisLabel: 'AC',
};
