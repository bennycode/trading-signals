import {PercentB as PercentBClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const PercentB: IndicatorConfig = {
  chartTitle: '%B (20, 2)',
  color: '#06b6d4',
  createIndicator: () => new PercentBClass({deviationMultiplier: 2, interval: 20}),
  description: 'Bollinger Bands %B',
  details:
    'Locates the close within the Bollinger Bands: 1 means the close sits on the upper band, 0 on the lower band and 0.5 on the middle band. The reading is not clamped, so values above 1 or below 0 flag closes breaking out of the bands (overbought/oversold pressure).',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'percent-b',
  name: '%B',
  processData: makeProcessData({rowInputs: ['close']}),
  requiredInputs: 20,
  type: 'single',
  yAxisLabel: '%B',
};
