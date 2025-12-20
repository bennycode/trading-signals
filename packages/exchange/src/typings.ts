// Some polyfills while Alpaca's API is highly experimental: https://github.com/alpacahq/alpaca-ts/pull/113
// See discussions in https://github.com/alpacahq/alpaca-ts/issues/106 & https://github.com/alpacahq/alpaca-ts/pull/113

export type CryptoAsset = {
  attributes: string[];
  class: string;
  easy_to_borrow: boolean;
  exchange: string;
  fractionable: boolean;
  id: string;
  maintenance_margin_requirement: number;
  marginable: boolean;
  min_order_size: string;
  min_trade_increment: string;
  name: string;
  price_increment: string;
  shortable: boolean;
  status: string;
  symbol: string;
  tradable: boolean;
};

export type PendingNewOrder = {
  asset_class: string;
  asset_id: string;
  canceled_at: string;
  client_order_id: string;
  created_at: string;
  expired_at: string;
  extended_hours: boolean;
  failed_at: string;
  filled_at: string;
  filled_avg_price: null;
  filled_qty: number;
  hwm: null;
  id: string;
  order_class: string;
  replaced_at: string;
  replaced_by: null;
  replaces: null;
  source: null;
  stop_price: null;
  submitted_at: string;
  subtag: null;
  symbol: string;
  time_in_force: string;
  trail_percent: null;
  trail_price: null;
  updated_at: string;
  // Distinct
  status: "pending_new";
  notional: number | null;
  qty: number | null;
  side: string;
  type: string;
  limit_price: number | null;
};

// Quantitative

export type QuantitativeMarketBuy = PendingNewOrder & {
  notional: null;
  qty: number;
  side: "buy";
  type: "market";
  limit_price: null;
};

export type QuantitativeMarketSell = PendingNewOrder & {
  notional: null;
  qty: number;
  side: "sell";
  type: "market";
  limit_price: null;
};

export type QuantitativeLimitBuy = PendingNewOrder & {
  notional: null;
  qty: number;
  side: "buy";
  type: "limit";
  limit_price: number;
};

export type QuantitativeLimitSell = PendingNewOrder & {
  notional: null;
  qty: number;
  side: "sell";
  type: "limit";
  limit_price: number;
};

// Notional

export type NotionalMarketBuy = PendingNewOrder & {
  notional: number;
  qty: null;
  side: "buy";
  type: "market";
  limit_price: null;
};

export type NotionalMarketSell = PendingNewOrder & {
  notional: number;
  qty: null;
  side: "sell";
  type: "market";
  limit_price: null;
};

export type NotionalLimitBuy = PendingNewOrder & {
  notional: number;
  qty: null;
  side: "buy";
  type: "limit";
  limit_price: number;
};

export type NotionalLimitSell = PendingNewOrder & {
  notional: number;
  qty: null;
  side: "sell";
  type: "limit";
  limit_price: number;
};

// Order union

export type PendingNewOrders =
  | NotionalLimitSell
  | NotionalLimitBuy
  | NotionalMarketSell
  | NotionalMarketBuy
  | QuantitativeLimitSell
  | QuantitativeLimitBuy
  | QuantitativeMarketSell
  | QuantitativeMarketBuy;

//

export interface ConnectedMessage {
  msg: "connected";
  T: "success";
}

export interface AuthenticatedMessage {
  msg: "authenticated";
  T: "success";
}

export interface SubscriptionMessage {
  bars: string[];
  cancelErrors: [];
  corrections: [];
  dailyBars: [];
  lulds: [];
  quotes: [];
  statuses: [];
  T: "subscription";
  trades: [];
  updatedBars: [];
}

/** https://docs.alpaca.markets/docs/real-time-stock-pricing-data#bars */
export type MinuteBarMessage = {
  /** Closing price */
  c: number;
  /** High price */
  h: number;
  /** Low price */
  l: number;
  /** Trade count in the bar */
  n: number;
  /** Open price */
  o: number;
  /** Symbol */
  S: string;
  /** Message type */
  T: "b";
  /** Timestamp in RFC-3339 format with nanosecond precision */
  t: string;
  /** Bar volume */
  v: number;
  /** Volume weighted average price */
  vw: number;
};

export type StreamMessage =
  | ConnectedMessage
  | AuthenticatedMessage
  | SubscriptionMessage
  | MinuteBarMessage;
