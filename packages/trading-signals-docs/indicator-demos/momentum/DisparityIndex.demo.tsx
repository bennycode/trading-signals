import {DisparityIndex as DisparityIndexClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const DisparityIndex: IndicatorConfig = {
  chartTitle: 'Disparity Index (14)',
  color: '#fb923c',
  createIndicator: () => new DisparityIndexClass(14),
  description: 'Disparity Index',
  details:
    'Measures how far the close has stretched above or below its own moving average, expressed as a percentage of that average. Above zero the close trades above its average (bullish pressure), below zero beneath it (bearish pressure). Extreme readings flag an over-extended move that is prone to snap back toward the average.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'disparity-index',
  name: 'DI',
  processData: makeProcessData({rowInputs: ['close']}),
  requiredInputs: 14,
  type: 'single',
  yAxisLabel: 'DI',
};
