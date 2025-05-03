import Benchmark, {type Event} from 'benchmark';
import candles from '../test/fixtures/candles/100-candles.json' with {type: 'json'};
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
  FasterIQR,
  FasterLinearRegression,
  FasterMACD,
  FasterMAD,
  FasterMOM,
  FasterOBV,
  FasterPeriod,
  FasterPSAR,
  FasterRMA,
  FasterROC,
  FasterRSI,
  FasterSMA,
  FasterStochasticOscillator,
  FasterStochasticRSI,
  FasterTDS,
  FasterTR,
  FasterWMA,
  FasterWSMA,
  getAverage,
  getFasterAverage,
  getFasterStandardDeviation,
  getStandardDeviation,
  IQR,
  LinearRegression,
  MACD,
  MAD,
  MOM,
  OBV,
  Period,
  RMA,
  ROC,
  RSI,
  PSAR,
  SMA,
  StochasticOscillator,
  StochasticRSI,
  TDS,
  TR,
  WMA,
  WSMA,
  type OpenHighLowCloseVolumeNumber,
} from '../index.js';

const shortInterval = 10;
const interval = 20;
const longInterval = 40;
const prices: number[] = candles.map(candle => parseFloat(candle.close));
const floatCandles: OpenHighLowCloseVolumeNumber[] = candles.map(candle => ({
  close: parseFloat(candle.close),
  high: parseFloat(candle.high),
  low: parseFloat(candle.low),
  open: parseFloat(candle.open),
  volume: parseFloat(candle.volume),
}));

new Benchmark.Suite('Technical Indicators')
  .add('AccelerationBands', () => {
    const accBands = new AccelerationBands(interval, 4);
    for (const candle of floatCandles) {
      accBands.add(candle);
    }
  })
  .add('FasterAccelerationBands', () => {
    const fasterAccBands = new FasterAccelerationBands(interval, 4);
    for (const candle of floatCandles) {
      fasterAccBands.add(candle);
    }
  })
  .add('AC', () => {
    const ac = new AC(shortInterval, longInterval, interval);
    for (const candle of floatCandles) {
      ac.add(candle);
    }
  })
  .add('FasterAC', () => {
    const fasterAC = new FasterAC(shortInterval, longInterval, interval);
    for (const candle of floatCandles) {
      fasterAC.add(candle);
    }
  })
  .add('ADX', () => {
    const adx = new ADX(interval);
    for (const candle of floatCandles) {
      adx.add(candle);
    }
  })
  .add('FasterADX', () => {
    const fasterADX = new FasterADX(interval);
    for (const candle of floatCandles) {
      fasterADX.add(candle);
    }
  })
  .add('AO', () => {
    const ao = new AO(shortInterval, interval);
    for (const candle of floatCandles) {
      ao.add(candle);
    }
  })
  .add('FasterAO', () => {
    const fasterAO = new FasterAO(shortInterval, interval);
    for (const candle of floatCandles) {
      fasterAO.add(candle);
    }
  })
  .add('ATR', () => {
    const atr = new ATR(interval);
    for (const candle of floatCandles) {
      atr.add(candle);
    }
  })
  .add('FasterATR', () => {
    const fasterATR = new FasterATR(interval);
    for (const candle of floatCandles) {
      fasterATR.add(candle);
    }
  })
  .add('BollingerBands', () => {
    const bb = new BollingerBands(interval, 2);
    for (const price of prices) {
      bb.add(price);
    }
  })
  .add('FasterBollingerBands', () => {
    const fasterBB = new FasterBollingerBands(interval, 2);
    for (const price of prices) {
      fasterBB.add(price);
    }
  })
  .add('BollingerBandsWidth', () => {
    const bbw = new BollingerBandsWidth(new BollingerBands(interval, 2));
    for (const price of prices) {
      bbw.add(price);
    }
  })
  .add('FasterBollingerBandsWidth', () => {
    const fasterBBW = new FasterBollingerBandsWidth(new FasterBollingerBands(interval, 2));
    for (const price of prices) {
      fasterBBW.add(price);
    }
  })
  .add('CCI', () => {
    const cci = new CCI(interval);
    for (const candle of floatCandles) {
      cci.add(candle);
    }
  })
  .add('FasterCCI', () => {
    const fasterCCI = new FasterCCI(interval);
    for (const candle of floatCandles) {
      fasterCCI.add(candle);
    }
  })
  .add('CG', () => {
    const cg = new CG(shortInterval, interval);
    for (const price of prices) {
      cg.add(price);
    }
  })
  .add('FasterCG', () => {
    const fasterCG = new FasterCG(shortInterval, interval);
    for (const price of prices) {
      fasterCG.add(price);
    }
  })
  .add('DEMA', () => {
    const dema = new DEMA(interval);
    for (const price of prices) {
      dema.add(price);
    }
  })
  .add('FasterDEMA', () => {
    const fasterDEMA = new FasterDEMA(interval);
    for (const price of prices) {
      fasterDEMA.add(price);
    }
  })
  .add('DMA', () => {
    const dma = new DMA(3, 6);
    for (const price of prices) {
      dma.add(price);
    }
  })
  .add('FasterDMA', () => {
    const fasterDMA = new FasterDMA(3, 6);
    for (const price of prices) {
      fasterDMA.add(price);
    }
  })
  .add('DX', () => {
    const dx = new DX(interval);
    for (const candle of floatCandles) {
      dx.add(candle);
    }
  })
  .add('FasterDX', () => {
    const fasterDX = new FasterDX(interval);
    for (const candle of floatCandles) {
      fasterDX.add(candle);
    }
  })
  .add('EMA', () => {
    const ema = new EMA(interval);
    for (const price of prices) {
      ema.add(price);
    }
  })
  .add('FasterEMA', () => {
    const fasterEMA = new FasterEMA(interval);
    for (const price of prices) {
      fasterEMA.add(price);
    }
  })
  .add('IQR', () => {
    const iqr = new IQR(interval);
    for (const price of prices) {
      iqr.add(price);
    }
  })
  .add('FasterIQR', () => {
    const iqr = new FasterIQR(interval);
    for (const price of prices) {
      iqr.add(price);
    }
  })
  .add('LinearRegression', () => {
    const linreg = new LinearRegression({period: interval});
    for (const price of prices) {
      linreg.add(price);
    }
  })
  .add('LinearRegression', () => {
    const linreg = new LinearRegression({period: interval});
    for (const price of prices) {
      linreg.add(price);
    }
  })
  .add('FasterLinearRegression', () => {
    const fasterLINREG = new FasterLinearRegression({period: interval});
    for (const price of prices) {
      fasterLINREG.add(price);
    }
  })
  .add('RMA', () => {
    const indicator = new RMA(interval);
    for (const price of prices) {
      indicator.add(price);
    }
  })
  .add('FasterRMA', () => {
    const indicator = new FasterRMA(interval);
    for (const price of prices) {
      indicator.add(price);
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
      mad.add(price);
    }
  })
  .add('FasterMACD', () => {
    const fasterMACD = new FasterMACD(new FasterEMA(2), new FasterEMA(5), new FasterEMA(9));
    for (const price of prices) {
      fasterMACD.add(price);
    }
  })
  .add('MAD', () => {
    const mad = new MAD(interval);
    for (const price of prices) {
      mad.add(price);
    }
  })
  .add('FasterMAD', () => {
    const fasterMad = new FasterMAD(interval);
    for (const price of prices) {
      fasterMad.add(price);
    }
  })
  .add('MOM', () => {
    const mom = new MOM(interval);
    for (const price of prices) {
      mom.add(price);
    }
  })
  .add('FasterMOM', () => {
    const fasterMOM = new FasterMOM(interval);
    for (const price of prices) {
      fasterMOM.add(price);
    }
  })
  .add('OBV', () => {
    const obv = new OBV();
    for (const candle of floatCandles) {
      obv.add(candle);
    }
  })
  .add('FasterOBV', () => {
    const fasterOBV = new FasterOBV();
    for (const candle of floatCandles) {
      fasterOBV.add(candle);
    }
  })
  .add('Period', () => {
    const period = new Period(interval);
    for (const price of prices) {
      period.add(price);
    }
  })
  .add('FasterPeriod', () => {
    const fasterPeriod = new FasterPeriod(interval);
    for (const price of prices) {
      fasterPeriod.add(price);
    }
  })
  .add('PSAR', () => {
    const psar = new PSAR({
      accelerationMax: 0.2,
      accelerationStep: 0.02,
    });
    for (const candle of floatCandles) {
      psar.add(candle);
    }
  })
  .add('FasterPSAR', () => {
    const fasterPSAR = new FasterPSAR({
      accelerationMax: 0.2,
      accelerationStep: 0.02,
    });
    for (const candle of floatCandles) {
      fasterPSAR.add(candle);
    }
  })
  .add('ROC', () => {
    const roc = new ROC(interval);
    for (const price of prices) {
      roc.add(price);
    }
  })
  .add('FasterROC', () => {
    const fasterROC = new FasterROC(interval);
    for (const price of prices) {
      fasterROC.add(price);
    }
  })
  .add('RSI', () => {
    const rsi = new RSI(interval);
    for (const price of prices) {
      rsi.add(price);
    }
  })
  .add('FasterRSI', () => {
    const fasterRSI = new FasterRSI(interval);
    for (const price of prices) {
      fasterRSI.add(price);
    }
  })
  .add('SMA', () => {
    const sma = new SMA(interval);
    for (const price of prices) {
      sma.add(price);
    }
  })
  .add('FasterSMA', () => {
    const fasterSMA = new FasterSMA(interval);
    for (const price of prices) {
      fasterSMA.add(price);
    }
  })
  .add('StochasticOscillator', () => {
    const stoch = new StochasticOscillator(shortInterval, interval, interval);
    for (const candle of candles) {
      stoch.add(candle);
    }
  })
  .add('FasterStochasticOscillator', () => {
    const fasterStoch = new FasterStochasticOscillator(shortInterval, interval, interval);
    for (const candle of floatCandles) {
      fasterStoch.add(candle);
    }
  })
  .add('StochasticRSI', () => {
    const stochRSI = new StochasticRSI(interval);
    for (const price of prices) {
      stochRSI.add(price);
    }
  })
  .add('FasterStochasticRSI', () => {
    const fasterStochRSI = new FasterStochasticRSI(interval);
    for (const price of prices) {
      fasterStochRSI.add(price);
    }
  })
  .add('TDS', () => {
    const tds = new TDS();
    for (const price of prices) {
      tds.add(price);
    }
  })
  .add('FasterTDS', () => {
    const fasterTDS = new FasterTDS();
    for (const price of prices) {
      fasterTDS.add(price);
    }
  })
  .add('TR', () => {
    const tr = new TR();
    for (const candle of floatCandles) {
      tr.add(candle);
    }
  })
  .add('FasterTR', () => {
    const fasterTR = new FasterTR();
    for (const candle of floatCandles) {
      fasterTR.add(candle);
    }
  })
  .add('WSMA', () => {
    const wsma = new WSMA(interval);
    for (const price of prices) {
      wsma.add(price);
    }
  })
  .add('FasterWSMA', () => {
    const fasterWSMA = new FasterWSMA(interval);
    for (const price of prices) {
      fasterWSMA.add(price);
    }
  })
  .add('WMA', () => {
    const wma = new WMA(interval);
    for (const price of prices) {
      wma.add(price);
    }
  })
  .add('FasterWMA', () => {
    const fasterWMA = new FasterWMA(interval);
    for (const price of prices) {
      fasterWMA.add(price);
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
