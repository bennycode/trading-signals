/**
 * Editable config fields per node type, driving the forms rendered inside canvas nodes.
 * Values are still validated by the engine's Zod schemas on every change — these
 * descriptors only decide which widget to render, they can never bypass validation.
 */
export interface NodeFieldDescriptor {
  key: string;
  label: string;
  widget: 'select' | 'number' | 'text';
  options?: readonly {value: string; label: string}[];
  placeholder?: string;
}

export const NODE_FIELDS: Record<string, readonly NodeFieldDescriptor[]> = {
  advice: [
    {
      key: 'side',
      label: 'Side',
      options: [
        {label: 'Buy', value: 'BUY'},
        {label: 'Sell', value: 'SELL'},
      ],
      widget: 'select',
    },
    {
      key: 'amountIn',
      label: 'Amount in',
      options: [
        {label: 'Counter (cash)', value: 'counter'},
        {label: 'Base (asset)', value: 'base'},
      ],
      widget: 'select',
    },
    {key: 'amount', label: 'Amount', placeholder: 'ALL_AVAILABLE_AMOUNT', widget: 'text'},
    {key: 'reason', label: 'Reason', placeholder: 'Why this order fires', widget: 'text'},
  ],
  batcher: [{key: 'timeframe', label: 'Timeframe', placeholder: 'e.g. 5m', widget: 'text'}],
  field: [
    {
      key: 'field',
      label: 'Field',
      options: [
        {label: 'Close', value: 'close'},
        {label: 'Open', value: 'open'},
        {label: 'High', value: 'high'},
        {label: 'Low', value: 'low'},
        {label: 'Volume', value: 'volume'},
        {label: 'Median price', value: 'medianPrice'},
      ],
      widget: 'select',
    },
  ],
  if: [
    {
      key: 'operator',
      label: 'Operator',
      options: [
        {label: 'A > B', value: 'gt'},
        {label: 'A ≥ B', value: 'gte'},
        {label: 'A < B', value: 'lt'},
        {label: 'A ≤ B', value: 'lte'},
        {label: 'A = B', value: 'eq'},
      ],
      widget: 'select',
    },
    {
      key: 'trigger',
      label: 'Fire',
      options: [
        {label: 'On change (crossover)', value: 'onChange'},
        {label: 'Every matching candle', value: 'always'},
      ],
      widget: 'select',
    },
  ],
  indicator: [
    {
      key: 'indicator',
      label: 'Indicator',
      options: [
        {label: 'SMA', value: 'SMA'},
        {label: 'EMA', value: 'EMA'},
        {label: 'RSI', value: 'RSI'},
      ],
      widget: 'select',
    },
    {key: 'period', label: 'Period', widget: 'number'},
  ],
  'source:candle': [],
};
