import {DeMarker as DeMarkerClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const DeMarker: IndicatorConfig = {
  chartTitle: 'DeMarker (14)',
  color: '#f43f5e',
  createIndicator: () => new DeMarkerClass(),
  description: 'DeMarker Indicator',
  details:
    'Weighs how far each candle pushes above the previous high against how far it dips below the previous low, averaged over the interval. Thomas DeMark designed it to read intra-bar extremes instead of closes, producing an oscillator between 0 and 1: readings of 0.7 or above flag an overbought market, 0.3 or below an oversold one, and a dead market reads neutral (0.5).',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['high', 'low']}),
  id: 'demarker',
  name: 'DeMarker',
  processData: makeProcessData({addInputs: ['high', 'low'], rowInputs: ['high', 'low']}),
  requiredInputs: 15,
  type: 'single',
  yAxisLabel: 'DeM',
};
