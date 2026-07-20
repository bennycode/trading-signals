import {StochasticRSI as StochasticRSIClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const StochasticRSI: IndicatorConfig = {
  chartTitle: 'Stochastic RSI (14)',
  color: '#ef4444',
  createIndicator: () => new StochasticRSIClass(14),
  description: 'Stochastic RSI',
  details: 'Applies Stochastic Oscillator to RSI values. More sensitive to overbought/oversold than standard RSI.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'stochrsi',
  name: 'StochRSI',
  processData: makeProcessData({rowInputs: ['close']}),
  requiredInputs: 14,
  type: 'single',
  yAxisLabel: 'StochRSI',
};
