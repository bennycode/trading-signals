import {HigherLowTrail as HigherLowTrailClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const HigherLowTrail: IndicatorConfig = {
  id: 'higher-low-trail',
  name: 'HigherLowTrail',
  description: 'Higher-Low Trailing Stop',
  color: '#84cc16',
  type: 'single',
  requiredInputs: 2,
  details:
    'Tracks a progressively rising stop-loss level by detecting one-sided pullback lows. Unlike a symmetric swing low, only right-side confirmation is required, so the trail responds faster. In monotonic mode (the default), the emitted level only ever rises.',
  createIndicator: () => new HigherLowTrailClass({lookback: 1}),
  processData: makeProcessData({rowInputs: ['low', 'close'], addInputs: ['high', 'low']}),
  getTableColumns: () => buildTableColumns({inputs: ['low', 'close'], signal: false}),
  chartTitle: 'Higher-Low Trail (lookback 1)',
  yAxisLabel: 'Price',
};
