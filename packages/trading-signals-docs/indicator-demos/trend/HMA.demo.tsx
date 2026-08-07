import {HMA as HMAClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const HMA: IndicatorConfig = {
  chartTitle: 'HMA (14)',
  color: '#14b8a6',
  createIndicator: () => new HMAClass(14),
  description: 'Hull Moving Average',
  details:
    'Solves the classic moving average dilemma: smoothing adds lag, and lag-reduction adds noise. The HMA amplifies recent price action and smooths the result over the square root of the interval — tracking price nearly in real time while staying smooth.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'hma',
  name: 'HMA',
  processData: makeProcessData({rowInputs: ['close']}),
  requiredInputs: 16,
  type: 'single',
  yAxisLabel: 'Price',
};
