import {ZigZag as ZigZagClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const ZigZag: IndicatorConfig = {
  chartTitle: 'ZigZag (5% deviation)',
  color: '#f43f5e',
  createIndicator: () => new ZigZagClass({deviation: 5}),
  description: 'ZigZag Indicator',
  details:
    'Filters out minor price movements by connecting significant pivot highs and lows. A new pivot is only confirmed once price reverses by at least the configured percentage (deviation).',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['high', 'low']}),
  id: 'zigzag',
  name: 'ZigZag',
  processData: makeProcessData({rowInputs: ['high', 'low']}),
  requiredInputs: 1,
  type: 'single',
  yAxisLabel: 'Price',
};
