import {HTTrendline as HTTrendlineClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const HTTrendline: IndicatorConfig = {
  chartTitle: 'HT Trendline',
  color: '#14b8a6',
  createIndicator: () => new HTTrendlineClass(),
  description: 'Hilbert Transform Instantaneous Trendline',
  details:
    'Measures the dominant market cycle with a Hilbert transform and averages price over exactly that many bars, cancelling the cycle component out of the series. What remains is the trend, tracked with less lag than a fixed-length moving average of comparable smoothness.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'ht-trendline',
  name: 'HT Trendline',
  processData: makeProcessData({rowInputs: ['close']}),
  requiredInputs: 64,
  type: 'single',
  yAxisLabel: 'Price',
};
