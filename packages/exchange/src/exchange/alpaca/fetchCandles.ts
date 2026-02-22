import 'dotenv-defaults/config.js';
import {ms, StringValue} from 'ms';
import {parseArgs} from 'node:util';
import {writeCandles} from '../../candle/writeCandles.js';
import {TradingPair} from '../TradingPair.js';
import {getAlpacaClient} from './getAlpacaClient.js';

const {values} = parseArgs({
  options: {
    base: {type: 'string', default: 'ETH'},
    counter: {type: 'string', default: 'USD'},
    from: {type: 'string', default: '2025-09-11T00:00:00.000Z'},
    to: {type: 'string', default: '2025-10-20T00:00:00.000Z'},
    interval: {type: 'string', default: '1d'},
    output: {type: 'string', short: 'o'},
  },
});

const exchange = getAlpacaClient({
  apiKey: process.env.ALPACA_PAPER_API_KEY ?? '',
  apiSecret: process.env.ALPACA_PAPER_API_SECRET ?? '',
  usePaperTrading: true,
});

const pair = new TradingPair(values.base, values.counter);
if (!values.interval) {
  throw new Error('Missing interval');
}
const interval = ms(values.interval as StringValue);

console.log(`Fetching "${pair.asString('/')}" (${values.interval} candles) from "${values.from}" to "${values.to}"...`);

const candles = await exchange.getCandles(pair, {
  intervalInMillis: interval,
  startTimeFirstCandle: values.from!,
  startTimeLastCandle: values.to!,
});

console.log(`Received ${candles.length} candles.`);

if (!values.output) {
  throw new Error('Missing output path');
}

await writeCandles(candles, values.output);
console.log(`Written to "${values.output}"`);

exchange.disconnect();
