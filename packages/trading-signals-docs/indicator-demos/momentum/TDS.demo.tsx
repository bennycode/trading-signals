import {TDS as TDSClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const TDS: IndicatorConfig = {
  id: 'tds',
  name: 'TDS',
  description: 'Tom DeMark Sequential',
  color: '#ec4899',
  type: 'single',
  requiredInputs: 1,
  details:
    'TDS tracks consecutive closes compared to the close 4 bars earlier. Bullish Setup: 9 consecutive closes greater than the close 4 bars earlier (returns 1, signals potential reversal - BEARISH). Bearish Setup: 9 consecutive closes less than the close 4 bars earlier (returns -1, signals potential reversal - BULLISH).',
  createIndicator: () => new TDSClass(),
  processData: makeProcessData({rowInputs: ['close'], signal: 'required', alwaysStable: true}),
  getTableColumns: () => buildTableColumns({inputs: ['close']}),
  chartTitle: 'Tom DeMark Sequential',
  yAxisLabel: 'TDS',
};
