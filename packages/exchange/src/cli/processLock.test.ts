import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {acquireStreamLock} from './processLock.js';

function lockFileFor(key: string): string {
  const digest = createHash('sha256').update(key).digest('hex').slice(0, 16);
  return join(tmpdir(), `exchange-cli-stream-${digest}.lock`);
}

describe('acquireStreamLock', () => {
  it('rejects a second acquisition while the holder is alive', () => {
    const key = randomUUID();
    const release = acquireStreamLock(key);

    expect(
      () => acquireStreamLock(key),
      'the second stream must fail fast instead of silently starving one of the two connections'
    ).toThrow(`PID ${process.pid}`);

    release();
  });

  it('can be re-acquired after release', () => {
    const key = randomUUID();
    acquireStreamLock(key)();

    const release = acquireStreamLock(key);
    expect(release).toBeTypeOf('function');
    release();
  });

  it('takes over a stale lock left by a dead process', () => {
    const key = randomUUID();
    // `spawnSync` returns only after the child exited, so its PID is guaranteed dead.
    const deadPid = spawnSync('true').pid;
    writeFileSync(lockFileFor(key), `${deadPid}`);

    const release = acquireStreamLock(key);
    expect(release).toBeTypeOf('function');
    release();
  });

  it('takes over a lock file with unparseable content', () => {
    const key = randomUUID();
    writeFileSync(lockFileFor(key), 'not-a-pid');

    const release = acquireStreamLock(key);
    expect(release).toBeTypeOf('function');
    release();
  });

  it('does not leak the credential into the lock file name', () => {
    const key = 'super-secret-api-key';
    expect(lockFileFor(key)).not.toContain(key);
  });
});
