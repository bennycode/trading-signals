import {RSI as RSIClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const RSI: IndicatorConfig = {
  chartTitle: 'RSI (14)',
  color: '#8b5cf6',
  createIndicator: () => new RSIClass(14),
  description: 'Relative Strength Index',
  details:
    'RSI measures the magnitude of recent price changes to evaluate overbought or oversold conditions. Values above 70 indicate overbought, below 30 indicate oversold.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'rsi',
  name: 'RSI',
  processData: makeProcessData({rowInputs: ['close']}),
  requiredInputs: 14,
  type: 'single',
  yAxisLabel: 'RSI',
};
