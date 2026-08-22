import {RCI as RCIClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const RCI: IndicatorConfig = {
  chartTitle: 'RCI (9)',
  color: '#6366f1',
  createIndicator: () => new RCIClass(9),
  description: 'Rank Correlation Index',
  details:
    'RCI applies Spearman rank correlation to price and time: it ranks the closes of the last 9 bars by recency and by price and measures how well the two rankings agree. A market that closes higher every bar reads +100, one that closes lower every bar reads -100. Values above +80 indicate overbought, below -80 indicate oversold.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'rci',
  name: 'RCI',
  processData: makeProcessData({rowInputs: ['close']}),
  requiredInputs: 9,
  type: 'single',
  yAxisLabel: 'RCI',
};
