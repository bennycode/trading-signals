import {GAPO as GAPOClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const GAPO: IndicatorConfig = {
  chartTitle: 'GAPO (14)',
  color: '#84cc16',
  createIndicator: () => new GAPOClass(14),
  description: 'Gopalakrishnan Range Index',
  details:
    'Relates the trading range of the window (highest high minus lowest low) to the window length on a logarithmic scale. Rising readings mean the range is widening (growing volatility), falling readings a contracting, quiet market. Range expansion carries no directional information, so the reading must be paired with a trend indicator to trade it.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['high', 'low']}),
  id: 'gapo',
  name: 'Gopalakrishnan Range Index',
  processData: makeProcessData({rowInputs: ['high', 'low']}),
  requiredInputs: 14,
  type: 'single',
  yAxisLabel: 'GAPO',
};
