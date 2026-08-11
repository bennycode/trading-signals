import {T3 as T3Class} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const T3: IndicatorConfig = {
  chartTitle: 'T3 (5)',
  color: '#22d3ee',
  createIndicator: () => new T3Class(5),
  description: 'Tillson T3 Moving Average',
  details:
    'Applies Tim Tillson’s "generalized DEMA" three times — a weighted blend of six cascaded EMAs — producing a curve that is smoother than an EMA yet turns with less lag. The volume factor (default 0.7) steers it between a plain EMA (0) and a full DEMA (1).',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 't3',
  name: 'T3',
  processData: makeProcessData({rowInputs: ['close']}),
  requiredInputs: 25,
  type: 'single',
  yAxisLabel: 'Price',
};
