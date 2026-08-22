import {ATR as ATRClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const ATR: IndicatorConfig = {
  chartTitle: 'ATR (14)',
  color: '#f59e0b',
  createIndicator: () => new ATRClass(14),
  description: 'Average True Range',
  details:
    'Measures market volatility by analyzing the range of price movements. Higher values indicate higher volatility; useful for setting stop-loss levels.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'atr',
  name: 'ATR',
  processData: makeProcessData({addInputs: ['high', 'low', 'close'], rowInputs: ['close']}),
  requiredInputs: 14,
  type: 'single',
  yAxisLabel: 'ATR',
};
