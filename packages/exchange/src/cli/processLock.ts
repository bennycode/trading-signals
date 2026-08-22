import {createHash} from 'node:crypto';
import {readFileSync, unlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

/**
 * Guards Alpaca's one-market-data-connection-per-API-key limit across CLI processes on this
 * machine: when a second stream connects with the same key, the server closes the first one
 * (whose crash-restart handler exits the process), leaving one side silently starved. This
 * lock makes the second process fail fast with an actionable message instead. Consumers on
 * other machines (e.g. a deployed bot) cannot be detected this way — that caveat remains
 * documentation.
 *
 * Returns a release function. A lock whose holding process is dead is taken over.
 */
export function acquireStreamLock(key: string): () => void {
  // Hash the key so the credential never appears in a file name.
  const digest = createHash('sha256').update(key).digest('hex').slice(0, 16);
  const lockFile = join(tmpdir(), `exchange-cli-stream-${digest}.lock`);

  // Two attempts: the second one re-races the atomic `wx` create after a stale lock was removed.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      // `wx` creates atomically and fails if the file exists.
      writeFileSync(lockFile, `${process.pid}`, {flag: 'wx'});
      return () => {
        try {
          unlinkSync(lockFile);
        } catch {
          // Already gone — nothing to release.
        }
      };
    } catch (error) {
      if (!isErrnoException(error) || error.code !== 'EEXIST') {
        throw error;
      }
      const holderPid = readHolderPid(lockFile);
      if (holderPid !== undefined && isProcessAlive(holderPid)) {
        throw new Error(
          `Another stream (PID ${holderPid}) is already connected with this Alpaca API key. ` +
            `Alpaca serves one market-data connection per key — a second connection makes the server drop the first. ` +
            `Stop that process or wait for it to finish.`
        );
      }
      /*
       * Stale lock from a dead process (or unreadable content): remove it and re-race the
       * `wx` create above. A plain overwrite here would let two contenders that both saw
       * the stale file proceed together; the delete-then-create keeps exactly one winner.
       */
      try {
        unlinkSync(lockFile);
      } catch {
        // Another contender removed it first — the retry races for the create either way.
      }
    }
  }
  throw new Error('Could not acquire the stream lock — another process took it while this one retried.');
}

/** The PID stored in the lock file, or undefined when the file vanished or holds no number. */
function readHolderPid(lockFile: string): number | undefined {
  try {
    const pid = Number(readFileSync(lockFile, 'utf8'));
    return Number.isInteger(pid) && pid > 0 ? pid : undefined;
  } catch {
    return undefined;
  }
}

function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }
  try {
    // Signal 0 performs the permission/existence check without sending a signal.
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM means the process exists but belongs to another user.
    return isErrnoException(error) && error.code === 'EPERM';
  }
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
