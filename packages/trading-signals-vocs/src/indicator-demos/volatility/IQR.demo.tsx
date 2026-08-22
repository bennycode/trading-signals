import {IQR as IQRClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const IQR: IndicatorConfig = {
  chartTitle: 'IQR (13)',
  color: '#6366f1',
  createIndicator: () => new IQRClass(13),
  description: 'Interquartile Range',
  details:
    'Statistical measure of variability showing the middle 50% of data. Robust measure of spread that is less sensitive to outliers than standard deviation.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'iqr',
  name: 'IQR',
  processData: makeProcessData({rowInputs: ['close']}),
  requiredInputs: 13,
  type: 'single',
  yAxisLabel: 'IQR',
};
