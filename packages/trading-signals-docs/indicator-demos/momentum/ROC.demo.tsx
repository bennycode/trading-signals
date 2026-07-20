import {ROC as ROCClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const ROC: IndicatorConfig = {
  chartTitle: 'ROC (9)',
  color: '#10b981',
  createIndicator: () => new ROCClass(9),
  description: 'Rate of Change',
  details:
    'Measures the percentage change in price from n periods ago. Positive values indicate upward momentum, negative values indicate downward momentum.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'roc',
  name: 'ROC',
  processData: makeProcessData({rowInputs: ['close']}),
  requiredInputs: 9,
  type: 'single',
  yAxisLabel: 'ROC %',
};
