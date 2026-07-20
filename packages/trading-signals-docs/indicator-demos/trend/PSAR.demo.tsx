import {PSAR as PSARClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const PSAR: IndicatorConfig = {
  chartTitle: 'Parabolic SAR',
  color: '#f97316',
  createIndicator: () => new PSARClass({accelerationMax: 0.2, accelerationStep: 0.02}),
  description: 'Parabolic SAR',
  details:
    'Identifies potential reversal points by placing dots above or below price. Dots below = uptrend, dots above = downtrend.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['high', 'low', 'close']}),
  id: 'psar',
  name: 'PSAR',
  processData: makeProcessData({rowInputs: ['high', 'low', 'close']}),
  requiredInputs: 2,
  type: 'single',
  yAxisLabel: 'Price',
};
