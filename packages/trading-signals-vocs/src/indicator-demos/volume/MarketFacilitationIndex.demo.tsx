import {MarketFacilitationIndex as MarketFacilitationIndexClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const MarketFacilitationIndex: IndicatorConfig = {
  chartTitle: 'Market Facilitation Index',
  color: '#f97316',
  createIndicator: () => new MarketFacilitationIndexClass(),
  description: 'Market Facilitation Index',
  details:
    "Bill Williams' Market Facilitation Index (BW MFI, unrelated to the Money Flow Index) divides each candle's trading range by its volume, showing how much price movement one unit of volume produced. Williams reads it only next to the volume change of the same candle — rising index on rising volume confirms participation, rising index on falling volume warns of a move without backing — so the value carries no standalone signal.",
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['high', 'low', 'volume']}),
  id: 'marketfi',
  name: 'MARKETFI',
  processData: makeProcessData({addInputs: ['close', 'high', 'low', 'volume'], rowInputs: ['high', 'low', 'volume']}),
  requiredInputs: 1,
  type: 'single',
  yAxisLabel: 'MARKETFI',
};
