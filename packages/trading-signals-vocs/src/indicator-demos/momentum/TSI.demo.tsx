import {TSI as TSIClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const TSI: IndicatorConfig = {
  chartTitle: 'TSI (25, 13)',
  color: '#d946ef',
  createIndicator: () => new TSIClass(),
  description: 'True Strength Index',
  details:
    'Double-smooths bar-to-bar price change with a long and a short EMA and divides it by the equally smoothed absolute change, bounding readings between -100 and +100. Above zero, buyers dominate; below zero, sellers dominate — zero-line crossings mark momentum changing sides.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'tsi',
  name: 'TSI',
  processData: makeProcessData({rowInputs: ['close']}),
  requiredInputs: 38,
  type: 'single',
  yAxisLabel: 'TSI',
};
