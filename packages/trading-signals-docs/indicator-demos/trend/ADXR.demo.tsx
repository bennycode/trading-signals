import {ADXR as ADXRClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const ADXR: IndicatorConfig = {
  chartTitle: 'ADXR (14)',
  color: '#f97316',
  createIndicator: () => new ADXRClass(14),
  description: 'Average Directional Movement Index Rating',
  details:
    'Averages the current ADX with its reading from one interval earlier, smoothing out ADX spikes. Wilder used it to rate how trendy a market is: high ratings mark instruments in sustained trends, low ratings mark directionless ones. Like the ADX, it measures only trend strength, never direction.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['high', 'low', 'close']}),
  id: 'adxr',
  name: 'ADXR',
  processData: makeProcessData({rowInputs: ['high', 'low', 'close']}),
  requiredInputs: 40,
  type: 'single',
  yAxisLabel: 'ADXR',
};
