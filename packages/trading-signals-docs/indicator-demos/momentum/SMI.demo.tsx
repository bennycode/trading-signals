import {SMI as SMIClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const SMI: IndicatorConfig = {
  chartTitle: 'SMI (10, 3, 3)',
  color: '#0891b2',
  createIndicator: () => new SMIClass(),
  description: 'Stochastic Momentum Index',
  details:
    'Locates the close relative to the midpoint of the recent high/low range and double-smooths that distance with two EMAs, bounding readings between -100 and +100. Readings of +40 and above indicate an overbought market, -40 and below an oversold market.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['high', 'low', 'close']}),
  id: 'smi',
  name: 'SMI',
  processData: makeProcessData({rowInputs: ['high', 'low', 'close']}),
  requiredInputs: 14,
  type: 'single',
  yAxisLabel: 'SMI',
};
