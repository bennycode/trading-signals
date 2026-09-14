#!/usr/bin/env node
import {runCli} from './runCli.js';

function flushAndExit(stream: NodeJS.WriteStream, output: string, code: number): void {
  stream.write(`${output}\n`, () => process.exit(code));
}

try {
  const result = runCli(process.argv.slice(2));
  flushAndExit(process.stdout, 'text' in result ? result.text : JSON.stringify(result.json), 0);
} catch (error) {
  flushAndExit(process.stderr, error instanceof Error ? error.message : String(error), 1);
}
