export * from './backtest/index.js';
export * from './strategy/index.js';
export {BuyOnceStrategy, BuyOnceSchema, type BuyOnceConfig} from './strategy-buy-once/BuyOnceStrategy.js';
/** @deprecated Use {@link BuyOnceStrategy} without `buyAt` instead. */
export {BuyOnceStrategy as BuyAndHoldStrategy, BuyOnceSchema as BuyAndHoldSchema} from './strategy-buy-once/BuyOnceStrategy.js';
export {BuyBelowSellAboveStrategy, BuyBelowSellAboveSchema, type BuyBelowSellAboveConfig} from './strategy-buy-below-sell-above/BuyBelowSellAboveStrategy.js';
export {CoinFlipStrategy, CoinFlipSchema, type CoinFlipConfig} from './strategy-coin-flip/CoinFlipStrategy.js';
export {MultiIndicatorConfluenceStrategy, MultiIndicatorConfluenceSchema, type MultiIndicatorConfluenceConfig} from './strategy-multi-indicator-confluence/MultiIndicatorConfluenceStrategy.js';
export {ScalpStrategy, ScalpSchema, type ScalpConfig} from './strategy-scalp/ScalpStrategy.js';
export {
  MeanReversionStrategy,
  MeanReversionSchema,
  type MeanReversionConfig,
} from './strategy-mean-reversion/MeanReversionStrategy.js';
export {NoopStrategy, NoopSchema, type NoopConfig} from './strategy-noop/NoopStrategy.js';
export {
  TrailingStopStrategy,
  TrailingStopSchema,
  type TrailingStopConfig,
  type TrailingStopState,
} from './strategy-trailing-stop/TrailingStopStrategy.js';
export {
  ProtectedStrategy,
  ProtectedStrategySchema,
  type ProtectedStrategyConfig,
  type ProtectedStrategyState,
} from './strategy-protected/ProtectedStrategy.js';
export {suggestScalpOffset} from './strategy-scalp/suggestScalpOffset.js';
export * from './report/index.js';
export {
  SP500HeatmapReport,
  SP500HeatmapSchema,
  type SP500HeatmapConfig,
} from './report-sp500-heatmap/SP500HeatmapReport.js';
export {
  SP500MomentumReport,
  SP500MomentumSchema,
  type SP500MomentumConfig,
} from './report-sp500-momentum/SP500MomentumReport.js';
export {
  ScalpScannerReport,
  ScalpScannerSchema,
  type ScalpScannerConfig,
} from './report-scalp-scanner/ScalpScannerReport.js';
