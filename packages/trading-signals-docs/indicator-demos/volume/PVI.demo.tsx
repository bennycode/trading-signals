import {PVI as PVIClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const PVI: IndicatorConfig = {
  chartTitle: 'Positive Volume Index',
  color: '#84cc16',
  createIndicator: () => new PVIClass(),
  description: 'Positive Volume Index',
  details:
    'Cumulative index starting at 1000 that compounds the percentage price change only on bars with rising volume — tracking what the crowd does on busy days. Read against its own long moving average: above suggests bull-market odds, below warns of a bear market.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close', 'volume']}),
  id: 'pvi',
  name: 'PVI',
  processData: makeProcessData({
    addInputs: ['close', 'high', 'low', 'volume'],
    rowInputs: ['close', 'volume'],
  }),
  requiredInputs: 1,
  type: 'single',
  yAxisLabel: 'PVI',
};
