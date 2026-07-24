import {TEMA as TEMAClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const TEMA: IndicatorConfig = {
  chartTitle: 'TEMA (9)',
  color: '#eab308',
  createIndicator: () => new TEMAClass(9),
  description: 'Triple Exponential Moving Average',
  details:
    'Combines a single, double and triple smoothed EMA (3×EMA − 3×EMA² + EMA³) to cancel out the lag that stacking EMAs would normally add — hugging price more closely than both EMA and DEMA.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'tema',
  name: 'TEMA',
  processData: makeProcessData({rowInputs: ['close']}),
  requiredInputs: 25,
  type: 'single',
  yAxisLabel: 'Price',
};
