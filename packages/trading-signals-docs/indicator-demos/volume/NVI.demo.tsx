import {NVI as NVIClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const NVI: IndicatorConfig = {
  chartTitle: 'Negative Volume Index',
  color: '#ef4444',
  createIndicator: () => new NVIClass(),
  description: 'Negative Volume Index',
  details:
    'Cumulative index that starts at 1000 and follows price changes only on falling-volume days, on the premise that "smart money" positions itself quietly while crowded high-volume days are noise. Traditionally read against its own one-year moving average rather than a fixed threshold.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close', 'volume']}),
  id: 'nvi',
  name: 'NVI',
  processData: makeProcessData({
    addInputs: ['close', 'high', 'low', 'volume'],
    rowInputs: ['close', 'volume'],
  }),
  requiredInputs: 1,
  type: 'single',
  yAxisLabel: 'NVI',
};
