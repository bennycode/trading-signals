import {CCI as CCIClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const CCI: IndicatorConfig = {
  id: 'cci',
  name: 'CCI',
  description: 'Commodity Channel Index',
  color: '#f59e0b',
  type: 'single',
  requiredInputs: 20,
  details: 'Measures deviation from the average price. Readings above +100 suggest overbought, below -100 suggest oversold.',
  createIndicator: () => new CCIClass(20),
  processData: makeProcessData({rowInputs: ['close'], addInputs: ['high', 'low', 'close']}),
  getTableColumns: indicator => buildTableColumns({inputs: ['close'], indicator}),
  chartTitle: 'CCI (20)',
  yAxisLabel: 'CCI',
};
