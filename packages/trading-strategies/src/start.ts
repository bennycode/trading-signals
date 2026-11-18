import {CoinFlip} from './strategy-coin-flip/coinFlip.js';

const strategy = new CoinFlip();

console.log(CoinFlip.NAME, strategy.latestAdvice);
