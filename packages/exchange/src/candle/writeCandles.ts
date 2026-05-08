import {writeFile} from 'node:fs/promises';
import type {ExchangeCandle} from '../exchange/Broker.js';

export async function writeCandles(candles: ExchangeCandle[], filePath: string): Promise<void> {
  await writeFile(filePath, JSON.stringify(candles, null, 2) + '\n');
}
