/**
 * Overrides the territory in which an oscillator reports an overbought or oversold market.
 * Defaults are indicator-specific (e.g. 70/30 for RSI, 80/20 for MFI) and follow the
 * literature; tighten or widen them to match the traded asset's volatility.
 */
export type SignalThresholds = {
  overbought?: number;
  oversold?: number;
};
