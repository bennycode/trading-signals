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
  IQR,
  LinearRegression,
  MACD,
  MAD,
  ZigZag,
  MOM,
  OBV,
  Period,
  PSAR,
  RMA,
  ROC,
  RSI,
  SMA,
  StochasticOscillator,
  StochasticRSI,
  TDS,
  TR,
  WMA,
  WSMA,
  getAverage,
  getFasterAverage,
  getFasterStandardDeviation,
  getStandardDeviation,
  REI,
  VWAP,
} from '../index.js';
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
  .add('AC', () => {
    const ac = new AC(shortInterval, longInterval, interval);
    for (const candle of floatCandles) {
      ac.add(candle);
    }
  })
  .add('ADX', () => {
    const adx = new ADX(interval);
    for (const candle of floatCandles) {
      adx.add(candle);
    }
  })
  .add('AO', () => {
    const ao = new AO(shortInterval, interval);
    for (const candle of floatCandles) {
      ao.add(candle);
    }
  })
  .add('ATR', () => {
    const atr = new ATR(interval);
    for (const candle of floatCandles) {
      atr.add(candle);
    }
  })
  .add('BollingerBands', () => {
    const bb = new BollingerBands(interval, 2);
    for (const price of prices) {
      bb.add(price);
    }
  })
  .add('BollingerBandsWidth', () => {
    const bbw = new BollingerBandsWidth(new BollingerBands(interval, 2));
    for (const price of prices) {
      bbw.add(price);
    }
  })
  .add('CCI', () => {
    const cci = new CCI(interval);
    for (const candle of floatCandles) {
      cci.add(candle);
    }
  })
  .add('CG', () => {
    const cg = new CG(shortInterval, interval);
    for (const price of prices) {
      cg.add(price);
    }
  })
  .add('DEMA', () => {
    const dema = new DEMA(interval);
    for (const price of prices) {
      dema.add(price);
    }
  })
  .add('DMA', () => {
    const dma = new DMA(3, 6);
    for (const price of prices) {
      dma.add(price);
    }
  })
  .add('DX', () => {
    const dx = new DX(interval);
    for (const candle of floatCandles) {
      dx.add(candle);
    }
  })
  .add('EMA', () => {
    const ema = new EMA(interval);
    for (const price of prices) {
      ema.add(price);
    }
  })
  .add('IQR', () => {
    const iqr = new IQR(interval);
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
  .add('RMA', () => {
    const indicator = new RMA(interval);
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
  .add('MAD', () => {
    const mad = new MAD(interval);
    for (const price of prices) {
      mad.add(price);
    }
  })
  .add('MOM', () => {
    const mom = new MOM(interval);
    for (const price of prices) {
      mom.add(price);
    }
  })
  .add('OBV', () => {
    const obv = new OBV();
    for (const candle of floatCandles) {
      obv.add(candle);
    }
  })
  .add('Period', () => {
    const period = new Period(interval);
    for (const price of prices) {
      period.add(price);
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
  .add('ROC', () => {
    const roc = new ROC(interval);
    for (const price of prices) {
      roc.add(price);
    }
  })
  .add('REI', () => {
    const rei = new REI(interval);
    for (const candle of candles) {
      rei.add(candle);
    }
  })
  .add('RSI', () => {
    const rsi = new RSI(interval);
    for (const price of prices) {
      rsi.add(price);
    }
  })
  .add('SMA', () => {
    const sma = new SMA(interval);
    for (const price of prices) {
      sma.add(price);
    }
  })
  .add('StochasticOscillator', () => {
    const stoch = new StochasticOscillator(shortInterval, interval, interval);
    for (const candle of candles) {
      stoch.add(candle);
    }
  })
  .add('StochasticRSI', () => {
    const stochRSI = new StochasticRSI(interval);
    for (const price of prices) {
      stochRSI.add(price);
    }
  })
  .add('TDS', () => {
    const tds = new TDS();
    for (const price of prices) {
      tds.add(price);
    }
  })
  .add('TR', () => {
    const tr = new TR();
    for (const candle of floatCandles) {
      tr.add(candle);
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
  .add('WMA', () => {
    const wma = new WMA(interval);
    for (const price of prices) {
      wma.add(price);
    }
  })
  .add('ZigZag', () => {
    const zigzag = new ZigZag({
      deviation: 15,
    });
    for (const candle of floatCandles) {
      zigzag.add(candle);
    }
  })
  .on('cycle', (event: Event) => {
    console.info(String(event.target));
  })
  .on('complete', () => {
    console.info('Finished benchmark.');
  })
  .run({async: true});
