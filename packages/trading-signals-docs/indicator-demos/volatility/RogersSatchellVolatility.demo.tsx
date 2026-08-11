import {RogersSatchellVolatility as RogersSatchellVolatilityClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const RogersSatchellVolatility: IndicatorConfig = {
  chartTitle: 'Rogers-Satchell Volatility (14)',
  color: '#d946ef',
  createIndicator: () => new RogersSatchellVolatilityClass(14),
  description: 'Rogers-Satchell Volatility',
  details:
    'Drift-independent range volatility estimator by Rogers and Satchell (1991). Each bar contributes a variance estimate built from how far its high and low stray from open and close, and the reading is the root of the window mean. A trending bar that runs straight from open to close reads as drift, not volatility, so it complements the close-to-close standard deviation, which is blind to intrabar ranges. Volatility carries no directional information, so there is no signal.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['open', 'high', 'low', 'close']}),
  id: 'rogers-satchell',
  name: 'Rogers-Satchell Volatility',
  processData: makeProcessData({rowInputs: ['open', 'high', 'low', 'close']}),
  requiredInputs: 14,
  type: 'single',
  yAxisLabel: 'RSV',
};
