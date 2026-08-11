import {VHF as VHFClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const VHF: IndicatorConfig = {
  chartTitle: 'VHF (28)',
  color: '#a855f7',
  createIndicator: () => new VHFClass(28),
  description: 'Vertical Horizontal Filter',
  details:
    'Relates the widest span between closing prices to the total ground those closes covered over the window, bounded between 0 and 1. Readings near 1 mark a market walking its span in a straight line (trending); readings near 0 mark a market crossing the same prices again and again (congesting). There is no fixed banding — the reading is compared against its own recent history, and it is direction-agnostic: a crash and a rally both read as trending, so the direction must come from a companion trend indicator.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'vhf',
  name: 'Vertical Horizontal Filter',
  processData: makeProcessData({rowInputs: ['close']}),
  requiredInputs: 29,
  type: 'single',
  yAxisLabel: 'VHF',
};
