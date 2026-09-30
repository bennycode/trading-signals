import {ZScore as ZScoreClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const ZScore: IndicatorConfig = {
  chartTitle: 'ZSCORE (20)',
  color: '#0ea5e9',
  createIndicator: () => new ZScoreClass(20),
  description: 'Z-Score',
  details:
    'Number of standard deviations the current value sits from the average of the prior values. Readings above 2 or below -2 mark unusually high or low values.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'zscore',
  name: 'ZSCORE',
  processData: makeProcessData({rowInputs: ['close']}),
  type: 'single',
  yAxisLabel: 'Z-Score',
};
