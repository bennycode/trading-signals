import Benchmark, {Event} from 'benchmark';
import candles from '../test/fixtures/candles/100-candles.json';
import {ADX} from '../ADX/ADX';
import {FasterMAD, MAD} from '../MAD/MAD';
import {BollingerBands, FasterBollingerBands} from '../BBANDS/BollingerBands';
import {FasterEMA, EMA} from '../EMA/EMA';
import {FasterSMA, SMA} from '../SMA/SMA';
import {FasterCCI, CCI} from '../CCI/CCI';
import {FasterTR, TR} from '../TR/TR';
import {DX} from '../DX/DX';
import {FasterWSMA, WSMA} from '../WSMA/WSMA';
import {FasterATR, ATR} from '../ATR/ATR';
import {
  FasterPeriod,
  getAverage,
  getFasterAverage,
  getFasterStandardDeviation,
  getStandardDeviation,
  HighLowCloseNumbers,
  Period,
} from '../util';
import {FasterRSI, RSI} from '../RSI/RSI';
import {FasterStochasticRSI, StochasticRSI} from '../STOCH/StochasticRSI';

const interval = 20;
const prices: number[] = candles.map(candle => parseInt(candle.close, 10));
const highLowCloses: HighLowCloseNumbers[] = candles.map(candle => ({
  close: parseInt(candle.close, 10),
  high: parseInt(candle.high, 10),
  low: parseInt(candle.low, 10),
}));

new Benchmark.Suite('Technical Indicators')
  .add('ADX', () => {
    const adx = new ADX(interval);
    for (const candle of highLowCloses) {
      adx.update(candle);
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
  .add('CCI', () => {
    const cci = new CCI(interval);
    for (const candle of highLowCloses) {
      cci.update(candle);
    }
  })
  .add('DX', () => {
    const dx = new DX(interval);
    for (const candle of highLowCloses) {
      dx.update(candle);
    }
  })
  .add('FasterCCI', () => {
    const fasterCCI = new FasterCCI(interval);
    for (const candle of highLowCloses) {
      fasterCCI.update(candle);
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
