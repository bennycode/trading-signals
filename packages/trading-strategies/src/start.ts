import {CoinFlipStrategy} from './strategy-coin-flip/CoinFlipStrategy.js';

const strategy = new CoinFlipStrategy();

const firstAdvice = await strategy.processCandle();
const secondAdvice = await strategy.processCandle();
const thirdAdvice = await strategy.processCandle();

console.log(firstAdvice, secondAdvice, thirdAdvice);
