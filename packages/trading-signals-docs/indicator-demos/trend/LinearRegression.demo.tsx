import {LinearRegression as LinearRegressionClass} from 'trading-signals';
import {NotAvailable} from '../../components/NotAvailable';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const LinearRegression: IndicatorConfig = {
  chartTitle: 'Linear Regression (14)',
  color: '#ec4899',
  createIndicator: () => new LinearRegressionClass(14),
  description: 'Linear Regression',
  details:
    'Fits a straight line to recent prices using least-squares. The prediction is the point on the line at the latest bar; the slope indicates trend direction and strength.',
  getTableColumns: indicator =>
    buildTableColumns({
      extra: [
        {
          className: 'text-slate-300 font-mono py-2 px-3',
          header: 'Slope',
          key: 'slope',
          render: val => (val === null || val === undefined ? <NotAvailable /> : val.toFixed(4)),
        },
      ],
      indicator,
      inputs: ['close'],
    }),
  id: 'linreg',
  name: 'LINREG',
  processData: (indicator, candle) => {
    indicator.add(Number(candle.close));
    const full = indicator.isStable ? indicator.getResult() : null;
    return {
      close: Number(candle.close),
      result: full?.prediction ?? null,
      slope: full?.slope ?? null,
    };
  },
  requiredInputs: 14,
  type: 'single',
  yAxisLabel: 'Price',
};
