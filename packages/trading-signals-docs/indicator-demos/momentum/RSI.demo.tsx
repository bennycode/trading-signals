import {RSI as RSIClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const RSI: IndicatorConfig = {
  id: 'rsi',
  name: 'RSI',
  description: 'Relative Strength Index',
  color: '#8b5cf6',
  type: 'single',
  requiredInputs: 14,
  details:
    'RSI measures the magnitude of recent price changes to evaluate overbought or oversold conditions. Values above 70 indicate overbought, below 30 indicate oversold.',
  createIndicator: () => new RSIClass(14),
  processData: makeProcessData({rowInputs: ['close']}),
  getTableColumns: indicator => buildTableColumns({inputs: ['close'], indicator}),
  chartTitle: 'RSI (14)',
  yAxisLabel: 'RSI',
};
