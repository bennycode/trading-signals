import {TR as TRClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const TR: IndicatorConfig = {
  id: 'tr',
  name: 'TR',
  description: 'True Range',
  color: '#ec4899',
  type: 'single',
  requiredInputs: 2,
  details:
    'Measures the greatest of: current high minus current low, absolute value of current high minus previous close, or absolute value of current low minus previous close. Low values indicate a sideways trend with little volatility.',
  createIndicator: () => new TRClass(),
  processData: makeProcessData({rowInputs: ['close'], addInputs: ['high', 'low', 'close']}),
  getTableColumns: indicator => buildTableColumns({inputs: ['close'], indicator}),
  chartTitle: 'True Range',
  yAxisLabel: 'TR',
};
