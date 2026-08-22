import {CCI as CCIClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const CCI: IndicatorConfig = {
  chartTitle: 'CCI (20)',
  color: '#f59e0b',
  createIndicator: () => new CCIClass(20),
  description: 'Commodity Channel Index',
  details:
    'Measures deviation from the average price. Readings above +100 suggest overbought, below -100 suggest oversold.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'cci',
  name: 'CCI',
  processData: makeProcessData({addInputs: ['high', 'low', 'close'], rowInputs: ['close']}),
  requiredInputs: 20,
  type: 'single',
  yAxisLabel: 'CCI',
};
