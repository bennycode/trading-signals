import {TDS as TDSClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const TDS: IndicatorConfig = {
  chartTitle: 'Tom DeMark Sequential',
  color: '#ec4899',
  createIndicator: () => new TDSClass(),
  description: 'Tom DeMark Sequential',
  details:
    'TDS tracks consecutive closes compared to the close 4 bars earlier. Bullish Setup: 9 consecutive closes greater than the close 4 bars earlier (returns 1, signals potential reversal - BEARISH). Bearish Setup: 9 consecutive closes less than the close 4 bars earlier (returns -1, signals potential reversal - BULLISH).',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'tds',
  name: 'TDS',
  processData: makeProcessData({alwaysStable: true, rowInputs: ['close']}),
  requiredInputs: 1,
  type: 'single',
  yAxisLabel: 'TDS',
};
