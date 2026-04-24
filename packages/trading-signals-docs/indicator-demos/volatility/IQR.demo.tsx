import {IQR as IQRClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const IQR: IndicatorConfig = {
  id: 'iqr',
  name: 'IQR',
  description: 'Interquartile Range',
  color: '#6366f1',
  type: 'single',
  requiredInputs: 13,
  details:
    'Statistical measure of variability showing the middle 50% of data. Robust measure of spread that is less sensitive to outliers than standard deviation.',
  createIndicator: () => new IQRClass(13),
  processData: makeProcessData({rowInputs: ['close'], signal: 'optional'}),
  getTableColumns: () => buildTableColumns({inputs: ['close']}),
  chartTitle: 'IQR (13)',
  yAxisLabel: 'IQR',
};
