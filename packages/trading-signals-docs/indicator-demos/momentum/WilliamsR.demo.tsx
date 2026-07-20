import {WilliamsR as WilliamsRClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const WilliamsR: IndicatorConfig = {
  chartTitle: 'Williams %R (14)',
  color: '#22d3ee',
  createIndicator: () => new WilliamsRClass(14),
  description: 'Williams Percent Range',
  details:
    'Measures overbought and oversold levels on an inverted scale from 0 to -100. Values from 0 to -20 indicate overbought conditions, while -80 to -100 indicate oversold conditions.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['high', 'low', 'close']}),
  id: 'willr',
  name: 'Williams %R',
  processData: makeProcessData({rowInputs: ['high', 'low', 'close']}),
  requiredInputs: 14,
  type: 'single',
  yAxisLabel: 'Williams %R',
};
