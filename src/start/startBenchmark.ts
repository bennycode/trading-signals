import Benchmark, {Event} from 'benchmark';
import candles from '../test/fixtures/candles/100-candles.json';
import {FasterMAD, MAD} from '../MAD/MAD';
import {BollingerBands, FasterBollingerBands} from '../BBANDS/BollingerBands';
import {EMA, FasterEMA} from '../EMA/EMA';
import {getFasterAverage, getAverage, getFasterStandardDeviation, getStandardDeviation} from '../util';
import {SMA, FasterSMA} from '../SMA/SMA';

const interval = 20;
const prices = candles.map(candle => parseInt(candle.close, 10));

new Benchmark.Suite('Technical Indicators')
  .add('BollingerBands', () => {
    const bb = new BollingerBands(interval, 2);
    for (const price of prices) {
      bb.update(price);
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
  .add('FasterBollingerBands', () => {
    const fasterBB = new FasterBollingerBands(interval, 2);
    for (const price of prices) {
      fasterBB.update(price);
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
