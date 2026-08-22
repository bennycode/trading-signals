import {AO as AOClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const AO: IndicatorConfig = {
  chartTitle: 'Awesome Oscillator (5,34)',
  color: '#06b6d4',
  createIndicator: () => new AOClass(5, 34),
  description: 'Awesome Oscillator',
  details:
    "Measures market momentum using the difference between a 5-period and 34-period simple moving average of the bar's midpoints.",
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['high', 'low']}),
  id: 'ao',
  name: 'AO',
  processData: makeProcessData({rowInputs: ['high', 'low']}),
  requiredInputs: 34,
  type: 'single',
  yAxisLabel: 'AO',
};
