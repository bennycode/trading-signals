import {TR as TRClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const TR: IndicatorConfig = {
  chartTitle: 'True Range',
  color: '#ec4899',
  createIndicator: () => new TRClass(),
  description: 'True Range',
  details:
    'Measures the greatest of: current high minus current low, absolute value of current high minus previous close, or absolute value of current low minus previous close. Low values indicate a sideways trend with little volatility.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'tr',
  name: 'TR',
  processData: makeProcessData({addInputs: ['high', 'low', 'close'], rowInputs: ['close']}),
  requiredInputs: 2,
  type: 'single',
  yAxisLabel: 'TR',
};
