#!/usr/bin/env node
import {runCli} from './runCli.js';

/**
 * Exit explicitly after flushing instead of relying on a natural exit: broker WebSocket
 * connections (e.g. Alpaca's market-data stream) deliberately stay open for long-running
 * trading sessions and would keep a finished one-shot command's event loop alive forever.
 * The write callback guarantees the output is flushed before the process dies.
 */
function flushAndExit(stream: NodeJS.WriteStream, line: string, code: number): void {
  stream.write(`${line}\n`, () => process.exit(code));
}

try {
  const result = await runCli(process.argv.slice(2));
  flushAndExit(process.stdout, result.text ?? JSON.stringify(result.json, null, 2), 0);
} catch (error) {
  flushAndExit(process.stderr, error instanceof Error ? error.message : String(error), 1);
}
