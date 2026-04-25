import {ATR as ATRClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const ATR: IndicatorConfig = {
  id: 'atr',
  name: 'ATR',
  description: 'Average True Range',
  color: '#f59e0b',
  type: 'single',
  requiredInputs: 14,
  details:
    'Measures market volatility by analyzing the range of price movements. Higher values indicate higher volatility; useful for setting stop-loss levels.',
  createIndicator: () => new ATRClass(14),
  processData: makeProcessData({rowInputs: ['close'], addInputs: ['high', 'low', 'close']}),
  getTableColumns: indicator => buildTableColumns({inputs: ['close'], indicator}),
  chartTitle: 'ATR (14)',
  yAxisLabel: 'ATR',
};
