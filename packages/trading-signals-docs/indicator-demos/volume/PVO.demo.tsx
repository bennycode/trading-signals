import {PVO as PVOClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const PVO: IndicatorConfig = {
  chartTitle: 'PVO (12, 26)',
  color: '#14b8a6',
  createIndicator: () => new PVOClass(),
  description: 'Percentage Volume Oscillator',
  details:
    'The PPO applied to volume: divides the spread between the fast and slow volume EMA by the slow EMA. Readings above zero mean volume is expanding and lends conviction to the current move; crossings of the zero line mark a volume regime change.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['volume']}),
  id: 'pvo',
  name: 'PVO',
  processData: makeProcessData({rowInputs: ['volume']}),
  requiredInputs: 26,
  type: 'single',
  yAxisLabel: 'PVO (%)',
};
