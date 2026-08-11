import {CFO as CFOClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const CFO: IndicatorConfig = {
  chartTitle: 'CFO (14)',
  color: '#0ea5e9',
  createIndicator: () => new CFOClass(14),
  description: 'Chande Forecast Oscillator',
  details:
    'Measures the percentage gap between the close and the close projected by a linear regression over the preceding closes. Positive readings show price running ahead of its own trend (bullish pressure), negative readings show it falling short (bearish pressure).',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'cfo',
  name: 'CFO',
  processData: makeProcessData({rowInputs: ['close']}),
  requiredInputs: 15,
  type: 'single',
  yAxisLabel: 'CFO',
};
