import {PSL as PSLClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const PSL: IndicatorConfig = {
  chartTitle: 'PSL (12)',
  color: '#65a30d',
  createIndicator: () => new PSLClass(),
  description: 'Psychological Line',
  details:
    'Measures crowd sentiment as the percentage of the last 12 bars that closed above their previous close. Readings of 75 or above indicate overbought, 25 or below indicate oversold — the conventional bands on the Asian trading platforms where the indicator (also known as PSY) is a standard.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'psl',
  name: 'PSL',
  processData: makeProcessData({rowInputs: ['close']}),
  requiredInputs: 13,
  type: 'single',
  yAxisLabel: 'PSL',
};
