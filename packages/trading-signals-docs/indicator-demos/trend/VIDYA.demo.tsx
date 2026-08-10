import {VIDYA as VIDYAClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const VIDYA: IndicatorConfig = {
  chartTitle: 'VIDYA (10)',
  color: '#6366f1',
  createIndicator: () => new VIDYAClass(10),
  description: 'Variable Index Dynamic Average',
  details:
    'EMA variant that scales its smoothing weight by the absolute Chande Momentum Oscillator: strong one-directional momentum makes it track price closely, while choppy sideways action flattens it into a noise filter.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'vidya',
  name: 'VIDYA',
  processData: makeProcessData({rowInputs: ['close']}),
  requiredInputs: 11,
  type: 'single',
  yAxisLabel: 'Price',
};
