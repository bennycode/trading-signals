import Benchmark, {Event} from 'benchmark';
import {BollingerBands} from '../BBANDS/BollingerBands';
import {SMA} from '../SMA/SMA';
import {FasterSMA} from '../SMA/FasterSMA';
import candles from '../test/fixtures/candles/100-candles.json';
import {getFasterAverage, getAverage, getFasterStandardDeviation, getStandardDeviation} from '../util';

const interval = 20;
const prices = candles.map(candle => parseInt(candle.close, 10));

const bb = new BollingerBands(interval, 2);
const sma = new SMA(interval);
const fasterSMA = new FasterSMA(interval);

new Benchmark.Suite('Technical Indicators')
  .add('BollingerBands', () => {
    for (const price of prices) {
      bb.update(price);
    }
  })
  .add('SMA', () => {
    for (const price of prices) {
      sma.update(price);
    }
  })
  .add('FasterSMA', () => {
    for (const price of prices) {
      fasterSMA.update(price);
    }
  })
  .add('getAverage', () => {
    return getAverage(prices);
  })
  .add('fasterGetAverage', () => {
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
