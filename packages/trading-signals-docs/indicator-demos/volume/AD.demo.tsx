import {AD as ADClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const AD: IndicatorConfig = {
  chartTitle: 'Accumulation/Distribution',
  color: '#8b5cf6',
  createIndicator: () => new ADClass(),
  description: 'Accumulation/Distribution',
  details:
    'Uses the relationship between close price and high-low range, weighted by volume, to measure money flow. Rising AD confirms an uptrend, falling AD confirms a downtrend.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close', 'volume']}),
  id: 'ad',
  name: 'AD',
  processData: makeProcessData({
    addInputs: ['close', 'high', 'low', 'volume'],
    alwaysStable: true,
    rowInputs: ['close', 'volume'],
  }),
  requiredInputs: 1,
  type: 'single',
  yAxisLabel: 'AD',
};
