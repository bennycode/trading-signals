import {BOP as BOPClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const BOP: IndicatorConfig = {
  chartTitle: 'Balance of Power',
  color: '#eab308',
  createIndicator: () => new BOPClass(),
  description: 'Balance of Power',
  details:
    'Relates each candle body to its full range to show whether buyers or sellers were in control. Unsmoothed, so pair it with an SMA for the smoothed variant many chart platforms display.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['open', 'high', 'low', 'close']}),
  id: 'bop',
  name: 'BOP',
  processData: makeProcessData({rowInputs: ['open', 'high', 'low', 'close']}),
  requiredInputs: 1,
  type: 'single',
  yAxisLabel: 'BOP',
};
