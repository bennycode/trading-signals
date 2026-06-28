import {MAD as MADClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const MAD: IndicatorConfig = {
  chartTitle: 'MAD (10)',
  color: '#ef4444',
  createIndicator: () => new MADClass(10),
  description: 'Mean Absolute Deviation',
  details:
    'Average absolute deviation from the mean. Measures the average distance between each data point and the mean of the dataset.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'mad',
  name: 'MAD',
  processData: makeProcessData({rowInputs: ['close']}),
  requiredInputs: 10,
  type: 'single',
  yAxisLabel: 'MAD',
};
