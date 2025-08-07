import Benchmark, {type Event} from 'benchmark';
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
  ,
  ,
  ,
  ,
  ,
  ,
  ,
  ,
  ,
  ,
  ,
  ,
  ,
  ,
  ,
  ,
  ,
  ,
  ,
  ,
  ,
  ,
  ,
  ,
  ,
  ,
  ,
  ,
  ,
  ,
  ,
  ,
  getAverage,
  get,
  get,
  getStandardDeviation,
  IQR,
  LinearRegression,
  MACD,
  MAD,
  MOM,
  OBV,
  Period,
  PSAR,
  REI,
  ,
  RMA,
  ROC,
  RSI,
  SMA,
  StochasticOscillator,
  StochasticRSI,
  TDS,
  TR,
  VWAP,
  WMA,
  WSMA,
  ZigZag,
} from '../index.js';
import candles from '../test/fixtures/candles/100-candles.json' with {type: 'json'};

const shortInterval = 10;
const interval = 20;
const longInterval = 40;
const prices: number[] = candles.map(candle => parseFloat(candle.close));
const floatCandles = candles.map(candle => ({
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
  .add('', () => {
    const fasterAccBands = new (interval, 4);
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
  .add('', () => {
    const fasterAC = new (shortInterval, longInterval, interval);
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
  .add('', () => {
    const fasterADX = new (interval);
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
  .add('', () => {
    const fasterAO = new (shortInterval, interval);
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
  .add('', () => {
    const fasterATR = new (interval);
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
  .add('', () => {
    const fasterBB = new (interval, 2);
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
  .add('', () => {
    const fasterBBW = new (new (interval, 2));
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
  .add('', () => {
    const fasterCCI = new (interval);
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
  .add('', () => {
    const fasterCG = new (shortInterval, interval);
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
  .add('', () => {
    const fasterDEMA = new (interval);
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
  .add('', () => {
    const fasterDMA = new (3, 6);
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
  .add('', () => {
    const fasterDX = new (interval);
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
  .add('', () => {
    const fasterEMA = new (interval);
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
  .add('', () => {
    const iqr = new (interval);
    for (const price of prices) {
      iqr.add(price);
    }
  })
  .add('LinearRegression', () => {
    const linreg = new LinearRegression(interval);
    for (const price of prices) {
      linreg.add(price);
    }
  })
  .add('', () => {
    const fasterLINREG = new (interval);
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
  .add('', () => {
    const indicator = new (interval);
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
  .add('', () => {
    const fasterMACD = new (new (2), new (5), new (9));
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
  .add('', () => {
    const fasterMad = new (interval);
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
  .add('', () => {
    const fasterMOM = new (interval);
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
  .add('', () => {
    const fasterOBV = new ();
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
  .add('', () => {
    const fasterPeriod = new (interval);
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
  .add('', () => {
    const fasterPSAR = new ({
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
  .add('', () => {
    const fasterROC = new (interval);
    for (const price of prices) {
      fasterROC.add(price);
    }
  })
  .add('REI', () => {
    const rei = new REI(interval);
    for (const candle of candles) {
      rei.add(candle);
    }
  })
  .add('', () => {
    const fasterREI = new (interval);
    for (const candle of floatCandles) {
      fasterREI.add(candle);
    }
  })
  .add('RSI', () => {
    const rsi = new RSI(interval);
    for (const price of prices) {
      rsi.add(price);
    }
  })
  .add('', () => {
    const fasterRSI = new (interval);
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
  .add('', () => {
    const fasterSMA = new (interval);
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
  .add('', () => {
    const fasterStoch = new (shortInterval, interval, interval);
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
  .add('', () => {
    const fasterStochRSI = new (interval);
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
  .add('', () => {
    const fasterTDS = new ();
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
  .add('', () => {
    const fasterTR = new ();
    for (const candle of floatCandles) {
      fasterTR.add(candle);
    }
  })
  .add('VWAP', () => {
    const vwap = new VWAP();
    for (const candle of floatCandles) {
      vwap.add(candle);
    }
  })
  .add('WSMA', () => {
    const wsma = new WSMA(interval);
    for (const price of prices) {
      wsma.add(price);
    }
  })
  .add('', () => {
    const fasterWSMA = new (interval);
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
  .add('', () => {
    const fasterWMA = new (interval);
    for (const price of prices) {
      fasterWMA.add(price);
    }
  })
  .add('getAverage', () => {
    return getAverage(prices);
  })
  .add('get', () => {
    return get(prices);
  })
  .add('getStandardDeviation', () => {
    return getStandardDeviation(prices);
  })
  .add('get', () => {
    return get(prices);
  })
  .add('ZigZag', () => {
    const zigzag = new ZigZag({
      deviation: 15,
    });
    for (const candle of floatCandles) {
      zigzag.add(candle);
    }
  })
  .add('', () => {
    const fasterZigzag = new ({
      deviation: 15,
    });
    for (const candle of floatCandles) {
      fasterZigzag.add(candle);
    }
  })
  .on('cycle', (event: Event) => {
    console.info(String(event.target));
  })
  .on('complete', () => {
    console.info('Finished benchmark.');
  })
  .run({async: true});
