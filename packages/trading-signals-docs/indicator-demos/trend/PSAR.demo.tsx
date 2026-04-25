import {PSAR as PSARClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const PSAR: IndicatorConfig = {
  id: 'psar',
  name: 'PSAR',
  description: 'Parabolic SAR',
  color: '#f97316',
  type: 'single',
  requiredInputs: 2,
  details:
    'Identifies potential reversal points by placing dots above or below price. Dots below = uptrend, dots above = downtrend.',
  createIndicator: () => new PSARClass({accelerationStep: 0.02, accelerationMax: 0.2}),
  processData: makeProcessData({rowInputs: ['high', 'low', 'close']}),
  getTableColumns: indicator => buildTableColumns({inputs: ['high', 'low', 'close'], indicator}),
  chartTitle: 'Parabolic SAR',
  yAxisLabel: 'Price',
};
