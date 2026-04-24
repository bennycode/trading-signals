import {WilliamsR as WilliamsRClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const WilliamsR: IndicatorConfig = {
  id: 'willr',
  name: 'Williams %R',
  description: 'Williams Percent Range',
  color: '#22d3ee',
  type: 'single',
  requiredInputs: 14,
  details:
    'Measures overbought and oversold levels on an inverted scale from 0 to -100. Values from 0 to -20 indicate overbought conditions, while -80 to -100 indicate oversold conditions.',
  createIndicator: () => new WilliamsRClass(14),
  processData: makeProcessData({rowInputs: ['high', 'low', 'close'], signal: 'required'}),
  getTableColumns: () => buildTableColumns({inputs: ['high', 'low', 'close']}),
  chartTitle: 'Williams %R (14)',
  yAxisLabel: 'Williams %R',
};
