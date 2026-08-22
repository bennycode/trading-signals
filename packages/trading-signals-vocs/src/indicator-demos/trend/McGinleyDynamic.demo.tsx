import {McGinleyDynamic as McGinleyDynamicClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const McGinleyDynamic: IndicatorConfig = {
  chartTitle: 'McGinley Dynamic (14)',
  color: '#f59e0b',
  createIndicator: () => new McGinleyDynamicClass(14),
  description: 'McGinley Dynamic',
  details:
    'A self-adjusting moving average that speeds up in falling markets and slows down in rising ones, hugging price more closely than an EMA without the whipsaws of a fixed-period average.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'mcginley-dynamic',
  name: 'MD',
  processData: makeProcessData({rowInputs: ['close']}),
  requiredInputs: 14,
  type: 'single',
  yAxisLabel: 'Price',
};
