import {CoinFlipStrategy} from './strategy-coin-flip/CoinFlipStrategy.js';

const strategy = new CoinFlipStrategy();

console.log(CoinFlipStrategy.NAME, strategy.latestAdvice);
