import {AccumulativeSwingIndex as AccumulativeSwingIndexClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const AccumulativeSwingIndex: IndicatorConfig = {
  chartTitle: 'Accumulative Swing Index',
  color: '#2dd4bf',
  createIndicator: () => new AccumulativeSwingIndexClass(),
  description: 'Accumulative Swing Index',
  details:
    "Running total of Wilder's Swing Index, which scores each bar-to-bar move by weighing the close-to-close change against gaps and candle bodies. The accumulated line forms a synthetic price chart: trendline breaks on the index confirm breakouts on price, while a breakout the index refuses to follow is suspect.",
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['open', 'high', 'low', 'close']}),
  id: 'asi',
  name: 'ASI',
  processData: makeProcessData({rowInputs: ['open', 'high', 'low', 'close']}),
  requiredInputs: 2,
  type: 'single',
  yAxisLabel: 'ASI',
};
