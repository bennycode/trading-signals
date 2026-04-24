import {PVT as PVTClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const PVT: IndicatorConfig = {
  chartTitle: 'Price Volume Trend',
  color: '#10b981',
  createIndicator: () => new PVTClass(),
  description: 'Price Volume Trend',
  details:
    'Cumulative indicator that adds a proportional amount of volume based on percentage price change. More sensitive than OBV because it weights volume by price change rather than adding full volume.',
  getTableColumns: () => buildTableColumns({inputs: ['close', 'volume']}),
  id: 'pvt',
  name: 'PVT',
  processData: makeProcessData({rowInputs: ['close', 'volume'], addInputs: ['close', 'high', 'low', 'volume'], signal: 'required', alwaysStable: true}),
  requiredInputs: 2,
  type: 'single',
  yAxisLabel: 'PVT',
};
