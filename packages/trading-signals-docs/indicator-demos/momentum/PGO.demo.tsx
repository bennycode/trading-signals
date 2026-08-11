import {PGO as PGOClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const PGO: IndicatorConfig = {
  chartTitle: 'PGO (14)',
  color: '#0ea5e9',
  createIndicator: () => new PGOClass(),
  description: 'Pretty Good Oscillator',
  details:
    'Measures how far the close has traveled from its simple moving average, expressed in units of smoothed true range. Mark Johnson used it as a breakout system: readings above +3 flag a long breakout, readings below -3 a short breakout.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'pgo',
  name: 'PGO',
  processData: makeProcessData({addInputs: ['high', 'low', 'close'], rowInputs: ['close']}),
  requiredInputs: 27,
  type: 'single',
  yAxisLabel: 'PGO',
};
