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
  FasterDMA,
  FasterDX,
  FasterEMA,
  FasterMACD,
  FasterMAD,
  FasterMOM,
  FasterPeriod,
  FasterRSI,
  FasterSMA,
  FasterStochasticRSI,
  FasterTR,
  FasterWSMA,
  getAverage,
  getFasterAverage,
  getFasterStandardDeviation,
  getStandardDeviation,
  HighLowCloseNumber,
  MACD,
  MAD,
  MOM,
  Period,
  RSI,
  SMA,
  StochasticRSI,
  TR,
  WSMA,
} from '..';

const shortInterval = 10;
const interval = 20;
const longInterval = 40;
const prices: number[] = candles.map(candle => parseInt(candle.close, 10));
const highLowCloses: HighLowCloseNumber[] = candles.map(candle => ({
  close: parseInt(candle.close, 10),
  high: parseInt(candle.high, 10),
  low: parseInt(candle.low, 10),
}));

new Benchmark.Suite('Technical Indicators')
  .add('AccelerationBands', () => {
    const accBands = new AccelerationBands(interval, 4);
    for (const candle of highLowCloses) {
      accBands.update(candle);
    }
  })
  .add('FasterAccelerationBands', () => {
    const fasterAccBands = new FasterAccelerationBands(interval, 4);
    for (const candle of highLowCloses) {
      fasterAccBands.update(candle);
    }
  })
  .add('AC', () => {
    const ac = new AC(shortInterval, longInterval, interval);
    for (const candle of highLowCloses) {
      ac.update(candle);
    }
  })
  .add('FasterAC', () => {
    const fasterAC = new FasterAC(shortInterval, longInterval, interval);
    for (const candle of highLowCloses) {
      fasterAC.update(candle);
    }
  })
  .add('ADX', () => {
    const adx = new ADX(interval);
    for (const candle of highLowCloses) {
      adx.update(candle);
    }
  })
  .add('FasterADX', () => {
    const fasterADX = new FasterADX(interval);
    for (const candle of highLowCloses) {
      fasterADX.update(candle);
    }
  })
  .add('AO', () => {
    const ao = new AO(shortInterval, interval);
    for (const candle of highLowCloses) {
      ao.update(candle);
    }
  })
  .add('FasterAO', () => {
    const fasterAO = new FasterAO(shortInterval, interval);
    for (const candle of highLowCloses) {
      fasterAO.update(candle);
    }
  })
  .add('ATR', () => {
    const atr = new ATR(interval);
    for (const candle of highLowCloses) {
      atr.update(candle);
    }
  })
  .add('FasterATR', () => {
    const fasterATR = new FasterATR(interval);
    for (const candle of highLowCloses) {
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
    for (const candle of highLowCloses) {
      cci.update(candle);
    }
  })
  .add('FasterCCI', () => {
    const fasterCCI = new FasterCCI(interval);
    for (const candle of highLowCloses) {
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
    for (const candle of highLowCloses) {
      dx.update(candle);
    }
  })
  .add('FasterDX', () => {
    const fasterDX = new FasterDX(interval);
    for (const candle of highLowCloses) {
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
    for (const candle of highLowCloses) {
      tr.update(candle);
    }
  })
  .add('FasterTR', () => {
    const fasterTR = new FasterTR();
    for (const candle of highLowCloses) {
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
