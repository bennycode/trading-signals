import {STC as STCClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const STC: IndicatorConfig = {
  chartTitle: 'STC (23, 50, 10)',
  color: '#2dd4bf',
  createIndicator: () => new STCClass(),
  description: 'Schaff Trend Cycle',
  details:
    'STC runs the MACD line through two rounds of stochastic scaling and halfway smoothing, so it completes its 0-100 swings well before the MACD turns. Values of 75 or above indicate overbought, 25 or below indicate oversold.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'stc',
  name: 'STC',
  processData: makeProcessData({rowInputs: ['close']}),
  requiredInputs: 68,
  type: 'single',
  yAxisLabel: 'STC',
};
