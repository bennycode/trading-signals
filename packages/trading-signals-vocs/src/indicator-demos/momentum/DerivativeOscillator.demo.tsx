import {DerivativeOscillator as DerivativeOscillatorClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const DerivativeOscillator: IndicatorConfig = {
  chartTitle: 'Derivative Oscillator (14, 5, 3, 9)',
  color: '#e879f9',
  createIndicator: () => new DerivativeOscillatorClass(),
  description: 'Derivative Oscillator',
  details:
    'Constance Brown’s histogram of a double smoothed RSI: the RSI is filtered through two EMAs and the plotted value is its distance from a simple moving average signal line — the MACD construction applied to the RSI. Readings above zero signal bullish momentum, below zero bearish momentum, and divergences from price warn of exhaustion.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'derivative-oscillator',
  name: 'DOSC',
  processData: makeProcessData({rowInputs: ['close']}),
  requiredInputs: 29,
  type: 'single',
  yAxisLabel: 'DOSC',
};
