import Benchmark, {Event} from 'benchmark';
import candles from '../test/fixtures/candles/100-candles.json';
import {
  AC,
  AccelerationBands,
  ADX,
  AO,
  ATR,
  BollingerBands,
  BollingerBandsWidth,
  CCI,
  CG,
  DEMA,
  DMA,
  DX,
  EMA,
  FasterAC,
  FasterAccelerationBands,
  FasterADX,
  FasterAO,
  FasterATR,
  FasterBollingerBands,
  FasterBollingerBandsWidth,
  FasterCCI,
  FasterCG,
  FasterDEMA,
  FasterDMA,
  FasterDX,
  FasterEMA,
  FasterMACD,
  FasterMAD,
  FasterMOM,
  FasterOBV,
  FasterPeriod,
  FasterROC,
  FasterRSI,
  FasterSMA,
  FasterStochasticOscillator,
  FasterStochasticRSI,
  FasterTR,
  FasterWSMA,
  getAverage,
  getFasterAverage,
  getFasterStandardDeviation,
  getStandardDeviation,
  MACD,
  MAD,
  MOM,
  OBV,
  OpenHighLowCloseVolumeNumber,
  Period,
  ROC,
  RSI,
  SMA,
  StochasticOscillator,
  StochasticRSI,
  TR,
  WSMA,
} from '..';

const shortInterval = 10;
const interval = 20;
const longInterval = 40;
const prices: number[] = candles.map(candle => parseInt(candle.close, 10));
const openHighLowCloseVolumes: OpenHighLowCloseVolumeNumber[] = candles.map(candle => ({
  close: parseInt(candle.close, 10),
  high: parseInt(candle.high, 10),
  low: parseInt(candle.low, 10),
  open: parseInt(candle.open, 10),
  volume: parseInt(candle.volume, 10),
}));

new Benchmark.Suite('Technical Indicators')
  .add('AccelerationBands', () => {
    const accBands = new AccelerationBands(interval, 4);
    for (const candle of openHighLowCloseVolumes) {
      accBands.update(candle);
    }
  })
  .add('FasterAccelerationBands', () => {
    const fasterAccBands = new FasterAccelerationBands(interval, 4);
    for (const candle of openHighLowCloseVolumes) {
      fasterAccBands.update(candle);
    }
  })
  .add('AC', () => {
    const ac = new AC(shortInterval, longInterval, interval);
    for (const candle of openHighLowCloseVolumes) {
      ac.update(candle);
    }
  })
  .add('FasterAC', () => {
    const fasterAC = new FasterAC(shortInterval, longInterval, interval);
    for (const candle of openHighLowCloseVolumes) {
      fasterAC.update(candle);
    }
  })
  .add('ADX', () => {
    const adx = new ADX(interval);
    for (const candle of openHighLowCloseVolumes) {
      adx.update(candle);
    }
  })
  .add('FasterADX', () => {
    const fasterADX = new FasterADX(interval);
    for (const candle of openHighLowCloseVolumes) {
      fasterADX.update(candle);
    }
  })
  .add('AO', () => {
    const ao = new AO(shortInterval, interval);
    for (const candle of openHighLowCloseVolumes) {
      ao.update(candle);
    }
  })
  .add('FasterAO', () => {
    const fasterAO = new FasterAO(shortInterval, interval);
    for (const candle of openHighLowCloseVolumes) {
      fasterAO.update(candle);
    }
  })
  .add('ATR', () => {
    const atr = new ATR(interval);
    for (const candle of openHighLowCloseVolumes) {
      atr.update(candle);
    }
  })
  .add('FasterATR', () => {
    const fasterATR = new FasterATR(interval);
    for (const candle of openHighLowCloseVolumes) {
      fasterATR.update(candle);
    }
  })
  .add('BollingerBands', () => {
    const bb = new BollingerBands(interval, 2);
    for (const price of prices) {
      bb.update(price);
    }
  })
  .add('FasterBollingerBands', () => {
    const fasterBB = new FasterBollingerBands(interval, 2);
    for (const price of prices) {
      fasterBB.update(price);
    }
  })
  .add('BollingerBandsWidth', () => {
    const bbw = new BollingerBandsWidth(new BollingerBands(interval, 2));
    for (const price of prices) {
      bbw.update(price);
    }
  })
  .add('FasterBollingerBandsWidth', () => {
    const fasterBBW = new FasterBollingerBandsWidth(new FasterBollingerBands(interval, 2));
    for (const price of prices) {
      fasterBBW.update(price);
    }
  })
  .add('CCI', () => {
    const cci = new CCI(interval);
    for (const candle of openHighLowCloseVolumes) {
      cci.update(candle);
    }
  })
  .add('FasterCCI', () => {
    const fasterCCI = new FasterCCI(interval);
    for (const candle of openHighLowCloseVolumes) {
      fasterCCI.update(candle);
    }
  })
  .add('CG', () => {
    const cg = new CG(shortInterval, interval);
    for (const price of prices) {
      cg.update(price);
    }
  })
  .add('FasterCG', () => {
    const fasterCG = new FasterCG(shortInterval, interval);
    for (const price of prices) {
      fasterCG.update(price);
    }
  })
  .add('DEMA', () => {
    const dema = new DEMA(interval);
    for (const price of prices) {
      dema.update(price);
    }
  })
  .add('FasterDEMA', () => {
    const fasterDEMA = new FasterDEMA(interval);
    for (const price of prices) {
      fasterDEMA.update(price);
    }
  })
  .add('DMA', () => {
    const dma = new DMA(3, 6);
    for (const price of prices) {
      dma.update(price);
    }
  })
  .add('FasterDMA', () => {
    const fasterDMA = new FasterDMA(3, 6);
    for (const price of prices) {
      fasterDMA.update(price);
    }
  })
  .add('DX', () => {
    const dx = new DX(interval);
    for (const candle of openHighLowCloseVolumes) {
      dx.update(candle);
    }
  })
  .add('FasterDX', () => {
    const fasterDX = new FasterDX(interval);
    for (const candle of openHighLowCloseVolumes) {
      fasterDX.update(candle);
    }
  })
  .add('EMA', () => {
    const ema = new EMA(interval);
    for (const price of prices) {
      ema.update(price);
    }
  })
  .add('FasterEMA', () => {
    const fasterEMA = new FasterEMA(interval);
    for (const price of prices) {
      fasterEMA.update(price);
    }
  })
  .add('MACD', () => {
    const mad = new MACD({
      indicator: EMA,
      longInterval: 5,
      shortInterval: 2,
      signalInterval: 9,
    });
    for (const price of prices) {
      mad.update(price);
    }
  })
  .add('FasterMACD', () => {
    const fasterMACD = new FasterMACD(new FasterEMA(2), new FasterEMA(5), new FasterEMA(9));
    for (const price of prices) {
      fasterMACD.update(price);
    }
  })
  .add('MAD', () => {
    const mad = new MAD(interval);
    for (const price of prices) {
      mad.update(price);
    }
  })
  .add('FasterMAD', () => {
    const fasterMad = new FasterMAD(interval);
    for (const price of prices) {
      fasterMad.update(price);
    }
  })
  .add('MOM', () => {
    const mom = new MOM(interval);
    for (const price of prices) {
      mom.update(price);
    }
  })
  .add('FasterMOM', () => {
    const fasterMOM = new FasterMOM(interval);
    for (const price of prices) {
      fasterMOM.update(price);
    }
  })
  .add('OBV', () => {
    const obv = new OBV();
    for (const candle of openHighLowCloseVolumes) {
      obv.update(candle);
    }
  })
  .add('FasterOBV', () => {
    const fasterOBV = new FasterOBV();
    for (const candle of openHighLowCloseVolumes) {
      fasterOBV.update(candle);
    }
  })
  .add('Period', () => {
    const period = new Period(interval);
    for (const price of prices) {
      period.update(price);
    }
  })
  .add('FasterPeriod', () => {
    const fasterPeriod = new FasterPeriod(interval);
    for (const price of prices) {
      fasterPeriod.update(price);
    }
  })
  .add('ROC', () => {
    const roc = new ROC(interval);
    for (const price of prices) {
      roc.update(price);
    }
  })
  .add('FasterROC', () => {
    const fasterROC = new FasterROC(interval);
    for (const price of prices) {
      fasterROC.update(price);
    }
  })
  .add('RSI', () => {
    const rsi = new RSI(interval);
    for (const price of prices) {
      rsi.update(price);
    }
  })
  .add('FasterRSI', () => {
    const fasterRSI = new FasterRSI(interval);
    for (const price of prices) {
      fasterRSI.update(price);
    }
  })
  .add('SMA', () => {
    const sma = new SMA(interval);
    for (const price of prices) {
      sma.update(price);
    }
  })
  .add('FasterSMA', () => {
    const fasterSMA = new FasterSMA(interval);
    for (const price of prices) {
      fasterSMA.update(price);
    }
  })
  .add('StochasticOscillator', () => {
    const stoch = new StochasticOscillator(shortInterval, interval, interval);
    for (const candle of candles) {
      stoch.update(candle);
    }
  })
  .add('FasterStochasticOscillator', () => {
    const fasterStoch = new FasterStochasticOscillator(shortInterval, interval, interval);
    for (const candle of openHighLowCloseVolumes) {
      fasterStoch.update(candle);
    }
  })
  .add('StochasticRSI', () => {
    const stochRSI = new StochasticRSI(interval);
    for (const price of prices) {
      stochRSI.update(price);
    }
  })
  .add('FasterStochasticRSI', () => {
    const fasterStochRSI = new FasterStochasticRSI(interval);
    for (const price of prices) {
      fasterStochRSI.update(price);
    }
  })
  .add('TR', () => {
    const tr = new TR();
    for (const candle of openHighLowCloseVolumes) {
      tr.update(candle);
    }
  })
  .add('FasterTR', () => {
    const fasterTR = new FasterTR();
    for (const candle of openHighLowCloseVolumes) {
      fasterTR.update(candle);
    }
  })
  .add('WSMA', () => {
    const wsma = new WSMA(interval);
    for (const price of prices) {
      wsma.update(price);
    }
  })
  .add('FasterWSMA', () => {
    const fasterWSMA = new FasterWSMA(interval);
    for (const price of prices) {
      fasterWSMA.update(price);
    }
  })
  .add('getAverage', () => {
    return getAverage(prices);
  })
  .add('getFasterAverage', () => {
    return getFasterAverage(prices);
  })
  .add('getStandardDeviation', () => {
    return getStandardDeviation(prices);
  })
  .add('getFasterStandardDeviation', () => {
    return getFasterStandardDeviation(prices);
  })
  .on('cycle', (event: Event) => {
    console.info(String(event.target));
  })
  .on('complete', () => {
    console.info('Finished benchmark.');
  })
  .run({async: true});
