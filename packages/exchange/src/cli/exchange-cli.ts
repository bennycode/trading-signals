#!/usr/bin/env node
import {runCli} from './runCli.js';

// Keep broker diagnostics (including their signal handlers) out of machine-readable stdout.
console.log = console.error;

function flushAndExit(stream: NodeJS.WriteStream, output: string, code: number): void {
  // Market-data sockets can outlive a subscription. Flush before exiting the executable.
  stream.write(`${output}\n`, () => process.exit(code));
}

try {
  const result = await runCli(process.argv.slice(2));
  flushAndExit(process.stdout, 'text' in result ? result.text : JSON.stringify(result.json), 0);
} catch (error) {
  flushAndExit(process.stderr, error instanceof Error ? error.message : String(error), 1);
}
