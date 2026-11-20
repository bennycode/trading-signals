import type {ChildProcess} from 'node:child_process';
import {IbkrAPI} from '../api/IbkrAPI.js';
import {IbkrGatewayStage, type IbkrGatewayState} from './IbkrGatewayState.js';
import {isAuthenticated, loginToIbkrGateway} from './loginToIbkrGateway.js';
import {ensureGateway, startGateway, stopGateway} from './startIbkrGateway.js';

export interface IbkrGatewayLauncherOptions {
  account: string;
  gatewayUrl?: string | undefined;
  /** Reported as the launcher advances, so a caller can say "approve the push on your phone". */
  onStateChange?: ((state: IbkrGatewayState) => void) | undefined;
  password: string;
  /** The second factor to pick when the account has several enrolled. */
  twoFactorMethod?: string | undefined;
}

/**
 * Runs IBKR's Client Portal Gateway on the caller's behalf, so a credentials-only client works.
 *
 * The gateway is IBKR's own Java program: it holds the logged-in session and signs every request,
 * which is why {@link IbkrBroker} never sees a password. What it will not do is log itself in, and
 * its login page builds its form in client-side JavaScript with nothing to post to — so a browser
 * drives it, and that is the one part a caller has to opt into by installing `playwright`.
 *
 * Starting is deliberately not awaited by the constructor. A fresh login sends an IB Key push and
 * then waits for a human to tap it, which can be minutes; blocking construction on that would
 * stall a process with no way to report why. {@link ready} is the awaitable, {@link state} is the
 * progress, and `onStateChange` is the hook for showing it.
 *
 * IBKR does not accept a passkey for the Web API, so the push cannot be automated away. A session
 * left running is reused rather than re-logged, which is what keeps the pushes to roughly daily.
 */
export class IbkrGatewayLauncher {
  /** One per gateway address: two launchers racing for the same port would fight over the process. */
  static readonly #byUrl = new Map<string, IbkrGatewayLauncher>();

  readonly #api: IbkrAPI;
  readonly #options: IbkrGatewayLauncherOptions;
  readonly gatewayUrl: string;

  #child?: ChildProcess | undefined;
  #ready?: Promise<void> | undefined;
  #state: IbkrGatewayState = {stage: IbkrGatewayStage.IDLE};

  private constructor(options: IbkrGatewayLauncherOptions) {
    this.#options = options;
    this.gatewayUrl = options.gatewayUrl ?? IbkrAPI.URL_GATEWAY;
    // Its own client, ungated: the readiness gate elsewhere would deadlock against this one.
    this.#api = new IbkrAPI({gatewayUrl: this.gatewayUrl});
  }

  /**
   * The launcher for this address, created on first use.
   *
   * Shared because the gateway is a single process on a single port. Constructing two brokers
   * against one address should log in once, not download and start the gateway twice.
   */
  static for(options: IbkrGatewayLauncherOptions): IbkrGatewayLauncher {
    const url = options.gatewayUrl ?? IbkrAPI.URL_GATEWAY;
    const existing = IbkrGatewayLauncher.#byUrl.get(url);
    if (existing) {
      return existing;
    }

    const launcher = new IbkrGatewayLauncher(options);
    IbkrGatewayLauncher.#byUrl.set(url, launcher);
    return launcher;
  }

  get state(): IbkrGatewayState {
    return this.#state;
  }

  /** Resolves once the gateway reports a session, rejects with the reason it could not get one. */
  get ready(): Promise<void> {
    this.#ready ??= this.#bringUp();
    return this.#ready;
  }

  #advance(stage: IbkrGatewayStage, error?: Error): void {
    this.#state = error ? {error, stage} : {stage};
    this.#options.onStateChange?.(this.#state);
  }

  async #bringUp(): Promise<void> {
    try {
      /*
       * An already-authenticated gateway is left alone. Logging in again would send a push for
       * nothing, which is the difference between one tap a day and one per process start.
       */
      if (await isAuthenticated(this.gatewayUrl)) {
        this.#advance(IbkrGatewayStage.AUTHENTICATED);
        return;
      }

      if (!(await this.#isListening())) {
        this.#advance(IbkrGatewayStage.DOWNLOADING);
        await ensureGateway();
        this.#advance(IbkrGatewayStage.STARTING);
        this.#child = await startGateway();
      }

      this.#advance(IbkrGatewayStage.AWAITING_TWO_FACTOR);
      await loginToIbkrGateway({
        account: this.#options.account,
        gatewayUrl: this.gatewayUrl,
        password: this.#options.password,
        twoFactorMethod: this.#options.twoFactorMethod,
      });

      this.#advance(IbkrGatewayStage.AUTHENTICATED);
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      this.#advance(IbkrGatewayStage.FAILED, failure);
      throw failure;
    }
  }

  /** Whether something already answers on the port, so an existing gateway is not started twice. */
  async #isListening(): Promise<boolean> {
    return this.#api
      .getAuthStatus()
      .then(() => true)
      .catch(() => false);
  }

  /**
   * Stops the gateway, but only one this launcher started.
   *
   * A gateway that was already running belongs to whoever started it — killing it on
   * `disconnect()` would take down a session the rest of the machine is using.
   */
  stop(): void {
    if (this.#child) {
      stopGateway(this.#child);
      this.#child = undefined;
    }

    IbkrGatewayLauncher.#byUrl.delete(this.gatewayUrl);
    this.#ready = undefined;
    this.#advance(IbkrGatewayStage.IDLE);
  }
}

/**
 * A launcher for a broker that was given credentials, or nothing for one that was not.
 *
 * Kept out of {@link IbkrBroker} so the broker holds only the handle, not the decision.
 */
export function toIbkrGatewayLauncher(options?: {
  account?: string | undefined;
  gatewayUrl?: string | undefined;
  onGatewayStateChange?: ((state: IbkrGatewayState) => void) | undefined;
  password?: string | undefined;
  twoFactorMethod?: string | undefined;
}): IbkrGatewayLauncher | undefined {
  if (!options?.account || !options.password) {
    return undefined;
  }

  return IbkrGatewayLauncher.for({
    account: options.account,
    gatewayUrl: options.gatewayUrl,
    onStateChange: options.onGatewayStateChange,
    password: options.password,
    twoFactorMethod: options.twoFactorMethod,
  });
}
