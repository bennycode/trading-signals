import {KAMA as KAMAClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const KAMA: IndicatorConfig = {
  chartTitle: 'KAMA (10)',
  color: '#f97316',
  createIndicator: () => new KAMAClass(10),
  description: "Kaufman's Adaptive Moving Average",
  details:
    'Adapts its smoothing based on how efficiently price traveled over the interval: fast in clean trends, slow in noise. Hugs trending prices closely while staying flat through choppy sideways markets.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'kama',
  name: 'KAMA',
  processData: makeProcessData({rowInputs: ['close']}),
  requiredInputs: 10,
  type: 'single',
  yAxisLabel: 'Price',
};
