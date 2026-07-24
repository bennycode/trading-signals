import {CMO as CMOClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const CMO: IndicatorConfig = {
  chartTitle: 'CMO (14)',
  color: '#84cc16',
  createIndicator: () => new CMOClass(14),
  description: 'Chande Momentum Oscillator',
  details:
    'Relates the sum of gains to the sum of losses over the interval — faster and more symmetric than the RSI, oscillating between -100 and +100. Values above +50 indicate overbought, below -50 indicate oversold.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'cmo',
  name: 'CMO',
  processData: makeProcessData({rowInputs: ['close']}),
  requiredInputs: 15,
  type: 'single',
  yAxisLabel: 'CMO',
};
