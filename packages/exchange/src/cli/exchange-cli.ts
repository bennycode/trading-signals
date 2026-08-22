#!/usr/bin/env node
import {runCli} from './runCli.js';

/*
 * --live picks the environment file: .env.live for the real account, .env.sandbox otherwise.
 * This happens before argument parsing so credentials are in place when runCli reads them.
 * Variables already present in the environment (shell, .env via the npm script) win —
 * `process.loadEnvFile` never overrides. Both files are optional.
 */
const envFile = process.argv.includes('--live') ? '.env.live' : '.env.sandbox';
try {
  process.loadEnvFile(envFile);
} catch {
  // No environment file — whatever the process environment already provides is used as-is.
}

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
  // `compact` keeps the closing summary of watch-* commands on one line, preserving NDJSON output.
  const json = result.compact ? JSON.stringify(result.json) : JSON.stringify(result.json, null, 2);
  flushAndExit(process.stdout, result.text ?? json, 0);
} catch (error) {
  flushAndExit(process.stderr, error instanceof Error ? error.message : String(error), 1);
}
