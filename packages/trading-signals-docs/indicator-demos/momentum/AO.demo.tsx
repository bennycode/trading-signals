import {AO as AOClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const AO: IndicatorConfig = {
  id: 'ao',
  name: 'AO',
  description: 'Awesome Oscillator',
  color: '#06b6d4',
  type: 'single',
  requiredInputs: 34,
  details:
    "Measures market momentum using the difference between a 5-period and 34-period simple moving average of the bar's midpoints.",
  createIndicator: () => new AOClass(5, 34),
  processData: makeProcessData({rowInputs: ['high', 'low'], signal: 'required'}),
  getTableColumns: () => buildTableColumns({inputs: ['high', 'low']}),
  chartTitle: 'Awesome Oscillator (5,34)',
  yAxisLabel: 'AO',
};
