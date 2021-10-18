import Benchmark, {Event} from 'benchmark';
import {BollingerBands} from '../BBANDS/BollingerBands';
import {SMA} from '../SMA/SMA';

const interval = 20;
const price = 72;

const bb = new BollingerBands(interval, 2);
const sma = new SMA(interval);

new Benchmark.Suite('Technical Indicators')
  .add('BollingerBands', () => {
    while (!bb.isStable) {
      bb.update(price);
    }
  })
  .add('SMA', () => {
    while (!sma.isStable) {
      sma.update(price);
    }
  })
  .on('cycle', (event: Event) => {
    console.info(String(event.target));
  })
  .on('complete', () => {
    console.info('Finished benchmark.');
  })
  .run({async: true});
