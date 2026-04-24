import {MAD as MADClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const MAD: IndicatorConfig = {
  id: 'mad',
  name: 'MAD',
  description: 'Mean Absolute Deviation',
  color: '#ef4444',
  type: 'single',
  requiredInputs: 10,
  details:
    'Average absolute deviation from the mean. Measures the average distance between each data point and the mean of the dataset.',
  createIndicator: () => new MADClass(10),
  processData: makeProcessData({rowInputs: ['close']}),
  getTableColumns: indicator => buildTableColumns({inputs: ['close'], indicator}),
  chartTitle: 'MAD (10)',
  yAxisLabel: 'MAD',
};
