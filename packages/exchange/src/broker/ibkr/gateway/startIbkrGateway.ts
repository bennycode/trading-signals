import {spawn, type ChildProcess} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdir, rm, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {Readable} from 'node:stream';
import {IbkrAPI} from '../api/IbkrAPI.js';
import {SimplifiedHttpError} from '../../../util/SimplifiedHttpError.js';
import {isAuthenticated, loginToIbkrGateway} from './loginToIbkrGateway.js';

/**
 * Runs IBKR's Client Portal Gateway and keeps a session on it.
 *
 * The gateway is IBKR's own Java program: it holds the logged-in session and signs every request,
 * which is why {@link IbkrBroker} carries no credentials. What it does not do is log itself in —
 * that is a web form, so a browser drives it here.
 *
 * Replaces IBeam, which did the same job in a prebuilt image. The credentials are typed into a
 * login form either way, so whatever performs that step reads them in the clear; doing it here
 * keeps that to this file and Playwright rather than a third-party image.
 */
export const GATEWAY_DOWNLOAD_URL = 'https://download2.interactivebrokers.com/portal/clientportal.gw.zip';

/**
 * Where the unpacked gateway lives, gitignored because it is a vendor binary.
 *
 * Built from `import.meta.dirname` rather than a `file:` URL, whose `pathname` is percent-encoded
 * and so breaks on any checkout with a space in its path.
 */
export const GATEWAY_DIR = join(import.meta.dirname, '..', '..', '..', '..', '.clientportal.gw');

/** The gateway's address, taken from the port IBKR's own `root/conf.yaml` listens on. */
export const GATEWAY_URL = IbkrAPI.URL_GATEWAY;

/** Re-checked this often; a lapsed session is logged in again. */
const MAINTENANCE_INTERVAL_MS = 60_000;

/** Downloads and unpacks the gateway when it is not there yet. */
export async function ensureGateway(dir: string = GATEWAY_DIR): Promise<void> {
  if (existsSync(join(dir, 'bin', 'run.sh'))) {
    return;
  }

  console.info(`Downloading the Client Portal Gateway from ${GATEWAY_DOWNLOAD_URL}`);
  const response = await fetch(GATEWAY_DOWNLOAD_URL);

  if (!response.ok || !response.body) {
    throw new Error(`Could not download the gateway: ${response.status} ${response.statusText}.`);
  }

  await mkdir(dir, {recursive: true});
  const archive = join(dir, 'clientportal.gw.zip');
  await writeFile(archive, Readable.fromWeb(response.body));

  await run('unzip', ['-q', '-o', archive, '-d', dir]);
  await rm(archive);
}

/** Starts the gateway and resolves once it answers, so a login is not attempted against a dead port. */
export async function startGateway(dir: string = GATEWAY_DIR): Promise<ChildProcess> {
  /*
   * `detached` puts the shell and the `java` it starts in one process group, which is what
   * {@link stopGateway} needs to take both down together.
   */
  const child = spawn('bash', ['bin/run.sh', 'root/conf.yaml'], {
    cwd: dir,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout?.on('data', (chunk: Buffer) => process.stdout.write(`[gateway] ${chunk.toString()}`));
  child.stderr?.on('data', (chunk: Buffer) => process.stderr.write(`[gateway] ${chunk.toString()}`));

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (await isListening(GATEWAY_URL)) {
      return child;
    }
    await delay(1_000);
  }

  stopGateway(child);
  throw new Error('The gateway did not start listening within 60s.');
}

/**
 * Whether anything is answering on the gateway's port yet.
 *
 * A 401 counts: the port being open is the question here, and the gateway answers every
 * `/iserver` call with one until somebody logs in. Only a transport failure means it is not up,
 * and {@link SimplifiedHttpError} reports that as status 0 — the interceptor drops Axios's
 * `ECONNREFUSED` code, so the status is the only thing left to read it from.
 */
async function isListening(gatewayUrl: string): Promise<boolean> {
  try {
    await new IbkrAPI({gatewayUrl}).getAuthStatus();
    return true;
  } catch (error) {
    return !(error instanceof SimplifiedHttpError) || error.status !== 0;
  }
}

/**
 * Takes down the gateway and the `java` it runs.
 *
 * IBKR's `run.sh` starts `java` as a child instead of `exec`-ing it, so signalling the shell alone
 * leaves Java reparented to PID 1, still holding the port, and the next run finds a stale gateway
 * answering. Signalling the negated pid reaches the whole process group instead.
 */
export function stopGateway(child: ChildProcess): void {
  if (child.pid === undefined) {
    return;
  }

  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    // Already gone, or never made it into a group of its own; the direct signal is the fallback.
    child.kill('SIGTERM');
  }
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function run(command: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {stdio: 'inherit'});
    child.on('error', reject);
    child.on('exit', code => (code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}.`))));
  });
}

/**
 * Starts the gateway, logs in, and keeps the session alive until interrupted.
 *
 * The session lapses roughly daily and IBKR then sends a fresh push, so this stays in the
 * foreground: it is a thing a human is expected to be near, not a daemon.
 */
export async function runGateway(options: {account: string; password: string; twoFactorMethod?: string | undefined}) {
  await ensureGateway();
  const child = await startGateway();

  const shutdown = () => {
    stopGateway(child);
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  // Without this a thrown login leaves the Java process running with nothing supervising it.
  process.on('uncaughtException', error => {
    console.error(error);
    shutdown();
  });

  const logIn = async () => {
    console.info('No session, logging in. Approve the push on your phone when it arrives.');
    await loginToIbkrGateway({
      account: options.account,
      gatewayUrl: GATEWAY_URL,
      password: options.password,
      screenshotPath: join(GATEWAY_DIR, '..', '.gateway-outputs', `login-failed-${Date.now()}.png`),
      twoFactorMethod: options.twoFactorMethod,
    });
    console.info('Authenticated.');
  };

  /*
   * Only when there is no session. A gateway left running from earlier is often still logged in,
   * and logging in again would send a push for nothing.
   */
  if (await isAuthenticated(GATEWAY_URL)) {
    console.info('Already authenticated, keeping the existing session.');
  } else {
    await logIn();
  }

  // Nothing here is a retry loop against IBKR: a lapsed session is logged in again, a live one is left alone.
  for (;;) {
    await delay(MAINTENANCE_INTERVAL_MS);

    if (!(await isAuthenticated(GATEWAY_URL))) {
      await logIn().catch((error: unknown) => {
        console.error('Login failed, retrying at the next check:', error instanceof Error ? error.message : error);
      });
    }
  }
}
