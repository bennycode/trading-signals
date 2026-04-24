import {ZigZag as ZigZagClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const ZigZag: IndicatorConfig = {
  id: 'zigzag',
  name: 'ZigZag',
  description: 'ZigZag Indicator',
  color: '#f43f5e',
  type: 'single',
  requiredInputs: 1,
  details:
    'Filters out minor price movements by connecting significant pivot highs and lows. A new pivot is only confirmed once price reverses by at least the configured percentage (deviation).',
  createIndicator: () => new ZigZagClass({deviation: 5}),
  processData: makeProcessData({rowInputs: ['high', 'low']}),
  getTableColumns: indicator => buildTableColumns({inputs: ['high', 'low'], indicator}),
  chartTitle: 'ZigZag (5% deviation)',
  yAxisLabel: 'Price',
};
