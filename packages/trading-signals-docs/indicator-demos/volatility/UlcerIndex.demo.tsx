import {UlcerIndex as UlcerIndexClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const UlcerIndex: IndicatorConfig = {
  chartTitle: 'Ulcer Index (14)',
  color: '#a855f7',
  createIndicator: () => new UlcerIndexClass(14),
  description: 'Ulcer Index',
  details:
    'Downside volatility measure by Peter Martin. Root mean square of percentage drawdowns from the highest close in the window, penalizing both the depth and the duration of declines — upside moves never increase it.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'ulcer-index',
  name: 'Ulcer Index',
  processData: makeProcessData({rowInputs: ['close']}),
  requiredInputs: 14,
  type: 'single',
  yAxisLabel: 'UI',
};
