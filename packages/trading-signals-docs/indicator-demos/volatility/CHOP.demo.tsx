import {CHOP as CHOPClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const CHOP: IndicatorConfig = {
  chartTitle: 'CHOP (14)',
  color: '#0ea5e9',
  createIndicator: () => new CHOPClass(14),
  description: 'Choppiness Index',
  details:
    'Compares the ground price actually covered (the sum of true ranges) with the span of the window on a logarithmic scale, bounded between 0 and 100. Readings above 61.8 mark a consolidating, choppy market where trend-following entries are prone to whipsaws; readings below 38.2 mark a strong trend. The reading is direction-agnostic — a crash and a rally both read as trending — so the direction must come from a companion trend indicator.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'chop',
  name: 'Choppiness Index',
  processData: makeProcessData({addInputs: ['high', 'low', 'close'], rowInputs: ['close']}),
  requiredInputs: 15,
  type: 'single',
  yAxisLabel: 'CHOP',
};
