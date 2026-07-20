import {DX as DXClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const DX: IndicatorConfig = {
  chartTitle: 'DX (14)',
  color: '#84cc16',
  createIndicator: () => new DXClass(14),
  description: 'Directional Movement Index',
  details: 'Measures the strength of directional movement. The ADX is derived from smoothing the DX values over time.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['high', 'low', 'close']}),
  id: 'dx',
  name: 'DX',
  processData: makeProcessData({rowInputs: ['high', 'low', 'close']}),
  requiredInputs: 14,
  type: 'single',
  yAxisLabel: 'DX',
};
