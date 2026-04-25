import {DX as DXClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const DX: IndicatorConfig = {
  id: 'dx',
  name: 'DX',
  description: 'Directional Movement Index',
  color: '#84cc16',
  type: 'single',
  requiredInputs: 14,
  details: 'Measures the strength of directional movement. The ADX is derived from smoothing the DX values over time.',
  createIndicator: () => new DXClass(14),
  processData: makeProcessData({rowInputs: ['high', 'low', 'close']}),
  getTableColumns: indicator => buildTableColumns({inputs: ['high', 'low', 'close'], indicator}),
  chartTitle: 'DX (14)',
  yAxisLabel: 'DX',
};
