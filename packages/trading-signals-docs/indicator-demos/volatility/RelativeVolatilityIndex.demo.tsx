import {RelativeVolatilityIndex as RelativeVolatilityIndexClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const RelativeVolatilityIndex: IndicatorConfig = {
  chartTitle: 'RVI (14, 10)',
  color: '#eab308',
  createIndicator: () => new RelativeVolatilityIndexClass(),
  description: 'Relative Volatility Index',
  details:
    "Donald Dorsey's RSI-style oscillator over volatility instead of price change: the standard deviation of recent closes feeds an up stream when the close rises and a down stream when it falls, and Wilder-smoothing both streams yields the share of recent volatility that built up while prices were rising (0 to 100). Values above 60 indicate volatility building on the upside, below 40 on the downside. Dorsey designed it as a confirmation filter for other indicators, not a standalone signal.",
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'rvi',
  name: 'RVI',
  processData: makeProcessData({rowInputs: ['close']}),
  requiredInputs: 23,
  type: 'single',
  yAxisLabel: 'RVI',
};
