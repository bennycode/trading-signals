import {ROC as ROCClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const ROC: IndicatorConfig = {
  id: 'roc',
  name: 'ROC',
  description: 'Rate of Change',
  color: '#10b981',
  type: 'single',
  requiredInputs: 9,
  details:
    'Measures the percentage change in price from n periods ago. Positive values indicate upward momentum, negative values indicate downward momentum.',
  createIndicator: () => new ROCClass(9),
  processData: makeProcessData({rowInputs: ['close'], signal: 'required'}),
  getTableColumns: () => buildTableColumns({inputs: ['close']}),
  chartTitle: 'ROC (9)',
  yAxisLabel: 'ROC %',
};
