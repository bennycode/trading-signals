// @ts-ignore No type declarations available for dotenv-defaults
import 'dotenv-defaults/config';
import {parseArgs} from 'node:util';
import {ScalpScannerReport, ScalpScannerSchema} from '../report-scalp-scanner/ScalpScannerReport.js';

const {values} = parseArgs({
  options: {
    symbols: {type: 'string', short: 's'},
    days: {type: 'string', short: 'd', default: '60'},
  },
});

const apiKey = process.env.ALPACA_LIVE_API_KEY ?? '';
const apiSecret = process.env.ALPACA_LIVE_API_SECRET ?? '';

if (!apiKey || apiKey === 'secret' || !apiSecret || apiSecret === 'secret') {
  console.error('Missing Alpaca credentials. Set ALPACA_LIVE_API_KEY and ALPACA_LIVE_API_SECRET in .env');
  process.exit(1);
}

const config = ScalpScannerSchema.parse({
  apiKey,
  apiSecret,
  symbols: values.symbols ? values.symbols.split(',') : undefined,
  lookbackDays: parseInt(values.days!, 10),
});

const symbolCount = config.symbols?.length ?? 500;
console.log(`Scanning ${symbolCount} stocks over ${config.lookbackDays} trading days...`);
console.log('');

const report = new ScalpScannerReport(config);
const result = await report.run();

console.log(result);
