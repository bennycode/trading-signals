import {PremierStochastic as PremierStochasticClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const PremierStochastic: IndicatorConfig = {
  chartTitle: 'Premier Stochastic (8, 3)',
  color: '#d946ef',
  createIndicator: () => new PremierStochasticClass(),
  description: 'Premier Stochastic Oscillator',
  details:
    'Centers a fast stochastic around zero, calms it with a double EMA pass, and normalizes the outcome into the -1..+1 range. Lee Leibfarth published it in 2008: the zero line separates bullish from bearish momentum, readings beyond ±0.9 flag exhausted moves, and a pullback through ±0.2 marks the reversal.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'premier-stochastic',
  name: 'Premier Stochastic',
  processData: makeProcessData({addInputs: ['high', 'low', 'close'], rowInputs: ['close']}),
  requiredInputs: 12,
  type: 'single',
  yAxisLabel: 'PSO',
};
