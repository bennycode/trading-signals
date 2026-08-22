#!/usr/bin/env node
import {createReadStream} from 'node:fs';
import {createInterface} from 'node:readline';
import {runCli} from './runCli.js';

/**
 * Reads lines lazily so streaming sources (a live candle feed piped into stdin) produce
 * output per candle instead of waiting for the stream to end.
 */
function readLines(csvPath: string | undefined) {
  const source = csvPath ? createReadStream(csvPath) : process.stdin;
  return createInterface({crlfDelay: Infinity, input: source});
}

const csvFlagIndex = process.argv.indexOf('--csv');
const csvPath = csvFlagIndex === -1 ? undefined : process.argv[csvFlagIndex + 1];

try {
  await runCli(
    process.argv.slice(2),
    () => readLines(csvPath),
    line => console.log(line)
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
