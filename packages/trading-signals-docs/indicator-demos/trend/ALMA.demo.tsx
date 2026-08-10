import {ALMA as ALMAClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const ALMA: IndicatorConfig = {
  chartTitle: 'ALMA (9)',
  color: '#6366f1',
  createIndicator: () => new ALMAClass(9),
  description: 'Arnaud Legoux Moving Average',
  details:
    'Weights the price window with a Gaussian bell whose peak is shifted toward the newest prices: prices near the peak dominate the average for low lag, while the tails of the bell still dampen outliers for smoothness. Offset steers the peak, sigma the width of the bell.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'alma',
  name: 'ALMA',
  processData: makeProcessData({rowInputs: ['close']}),
  requiredInputs: 9,
  type: 'single',
  yAxisLabel: 'Price',
};
