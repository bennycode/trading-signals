import {IMI as IMIClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const IMI: IndicatorConfig = {
  chartTitle: 'IMI (14)',
  color: '#c026d3',
  createIndicator: () => new IMIClass(),
  description: 'Intraday Momentum Index',
  details:
    'Applies the RSI recipe to candle bodies: sums the open-to-close gains of up candles and losses of down candles over an interval, expressing buying pressure as a share of total pressure. Values above 70 indicate overbought, below 30 indicate oversold.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['open', 'high', 'low', 'close']}),
  id: 'imi',
  name: 'IMI',
  processData: makeProcessData({rowInputs: ['open', 'high', 'low', 'close']}),
  requiredInputs: 14,
  type: 'single',
  yAxisLabel: 'IMI',
};
