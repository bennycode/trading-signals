import {KVO as KVOClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const KVO: IndicatorConfig = {
  chartTitle: 'Klinger Volume Oscillator (34, 55)',
  color: '#f59e0b',
  createIndicator: () => new KVOClass(),
  description: 'Klinger Volume Oscillator',
  details:
    'Turns each candle into a signed "volume force" — full volume counted as buying or selling pressure by the trend of the high/low/close sum and scaled by its share of the current swing — then charts the spread between a short and a long EMA of that force to catch money-flow reversals early.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close', 'volume']}),
  id: 'kvo',
  name: 'KVO',
  processData: makeProcessData({addInputs: ['close', 'high', 'low', 'volume'], rowInputs: ['close', 'volume']}),
  requiredInputs: 2,
  type: 'single',
  yAxisLabel: 'KVO',
};
