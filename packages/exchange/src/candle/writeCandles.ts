import {writeFile} from 'node:fs/promises';
import type {Candle} from '../broker/Broker.js';

export async function writeCandles(candles: Candle[], filePath: string): Promise<void> {
  await writeFile(filePath, JSON.stringify(candles, null, 2) + '\n');
}
