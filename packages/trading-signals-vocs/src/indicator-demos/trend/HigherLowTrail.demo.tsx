import {HigherLowTrail as HigherLowTrailClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const HigherLowTrail: IndicatorConfig = {
  chartTitle: 'Higher-Low Trail (lookback 1)',
  color: '#84cc16',
  createIndicator: () => new HigherLowTrailClass({lookback: 1}),
  description: 'Higher-Low Trailing Stop',
  details:
    'Tracks a progressively rising stop-loss level by detecting one-sided pullback lows. Unlike a symmetric swing low, only right-side confirmation is required, so the trail responds faster. In monotonic mode (the default), the emitted level only ever rises.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['low', 'close']}),
  id: 'higher-low-trail',
  name: 'HigherLowTrail',
  processData: makeProcessData({addInputs: ['high', 'low'], rowInputs: ['low', 'close']}),
  requiredInputs: 2,
  type: 'single',
  yAxisLabel: 'Price',
};
