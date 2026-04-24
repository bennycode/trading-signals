import {StochasticRSI as StochasticRSIClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const StochasticRSI: IndicatorConfig = {
  id: 'stochrsi',
  name: 'StochRSI',
  description: 'Stochastic RSI',
  color: '#ef4444',
  type: 'single',
  requiredInputs: 14,
  details: 'Applies Stochastic Oscillator to RSI values. More sensitive to overbought/oversold than standard RSI.',
  createIndicator: () => new StochasticRSIClass(14),
  processData: makeProcessData({rowInputs: ['close'], signal: 'required'}),
  getTableColumns: () => buildTableColumns({inputs: ['close']}),
  chartTitle: 'Stochastic RSI (14)',
  yAxisLabel: 'StochRSI',
};
