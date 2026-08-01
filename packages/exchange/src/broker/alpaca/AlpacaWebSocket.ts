import {EventEmitter} from 'node:events';
import {ms} from 'ms';
import type {RetryConfig} from 'ts-retry-promise';
import {retry} from 'ts-retry-promise';
import {AlpacaStream, type AlpacaStreamCredentials} from './api/AlpacaStream.js';
import type {MinuteBarMessage, StreamMessage} from './api/schema/StreamSchema.js';

const hasErrorCode = (error: unknown): error is {code: string | number} => {
  return !!error && typeof error === 'object' && 'code' in error;
};

export interface AlpacaConnection {
  connectionId: string;
  stream: AlpacaStream;
}

/**
 * Alpaca only allows 1 WebSocket connection per API key. This class manages
 * WebSocket connections as singletons to avoid the following error:
 * {"T":"error","code":406,"msg":"connection limit exceeded"}
 *
 * When a connection drops unexpectedly it is re-established in-process (same
 * `connectionId`, same bar subscriptions) instead of killing the process —
 * other trading sessions and bots share this process and must keep running.
 * Hosts can observe the lifecycle via the emitted `reconnecting`,
 * `resubscribed`, and `reconnect_failed` events.
 */
class AlpacaWebSocket extends EventEmitter {
  readonly #connections: Map<string, AlpacaConnection> = new Map();
  /** Bar callbacks per connection, keyed by symbol, so reconnects can restore them. */
  readonly #subscriptions: Map<string, Map<string, Set<(bar: MinuteBarMessage) => void>>> = new Map();
  readonly #credentialToConnectionId: Map<string, string> = new Map();
  /** Connection parameters retained for re-authentication after a transport drop. */
  readonly #connectionParams: Map<string, {credentials: AlpacaStreamCredentials; source: string}> = new Map();
  /** Connections closed via `disconnect()` — their `close` event must not trigger a reconnect. */
  readonly #intentionalCloses: Set<string> = new Set();

  /**
   * @see https://docs.alpaca.markets/docs/streaming-market-data#connection
   *
   * Retryable errors (transient):
   * - 406: connection limit exceeded (previous connection may time out)
   * - 407: slow client
   * - 500: internal error
   *
   * Non-retryable errors (permanent):
   * - 402: auth failed (invalid credentials)
   * - 404: auth timeout
   * - 405: symbol limit exceeded
   * - 409: insufficient subscription (plan upgrade required)
   */
  static readonly #NON_RETRYABLE_CODES = new Set([402, 404, 405, 409]);

  readonly #retryConfig: Partial<RetryConfig> = {
    delay: ms('30s'),
    retries: 'INFINITELY',
    retryIf: (error: unknown) => {
      console.error(`AlpacaWebSocket error: ${error}`);
      if (hasErrorCode(error) && AlpacaWebSocket.#NON_RETRYABLE_CODES.has(Number(error.code))) {
        return false;
      }
      return true;
    },
    timeout: 'INFINITELY',
  } as const;

  #openStream(credentials: AlpacaStreamCredentials, source: string, connectionId: string): Promise<AlpacaStream> {
    return new Promise<AlpacaStream>((resolve, reject) => {
      const stream = new AlpacaStream(credentials, source);

      stream.on('error', (error: unknown) => {
        console.error(`WebSocket streaming failed for ID "${connectionId}".`, error);
        reject(error);
      });

      stream.on('subscription', (message: unknown) => {
        console.log(`WebSocket streaming is subscribed with ID "${connectionId}":`, JSON.stringify(message));
      });

      stream.once('authenticated', () => {
        console.log(`WebSocket streaming is authenticated with ID "${connectionId}".`);
        resolve(stream);
      });
    });
  }

  /**
   * Installs the single message handler plus the close watchdog on a freshly
   * authenticated stream. Exactly one message handler exists per stream, so
   * repeated subscribe/unsubscribe cycles cannot stack duplicate listeners.
   */
  #wireStream(connectionId: string, stream: AlpacaStream): void {
    stream.on('message', (message: StreamMessage) => {
      this.#dispatchBar(connectionId, message);
    });

    stream.once('close', () => {
      if (this.#intentionalCloses.delete(connectionId)) {
        return;
      }
      console.error(`Market-data WebSocket closed unexpectedly for "${connectionId}". Reconnecting in-process.`);
      this.emit('reconnecting', {connectionId});
      void this.#reconnect(connectionId);
    });
  }

  #dispatchBar(connectionId: string, message: StreamMessage): void {
    if (message.T !== 'b') {
      return;
    }
    const callbacks = this.#subscriptions.get(connectionId)?.get(message.S);
    if (!callbacks) {
      return;
    }
    for (const cb of callbacks) {
      cb(message);
    }
  }

  async #reconnect(connectionId: string): Promise<void> {
    const params = this.#connectionParams.get(connectionId);
    if (!params) {
      return;
    }

    try {
      const stream = await retry(
        () => this.#openStream(params.credentials, params.source, connectionId),
        this.#retryConfig
      );

      const connection = this.#connections.get(connectionId);
      if (!connection) {
        // Disconnected while the reconnect was in flight
        stream.close();
        return;
      }

      connection.stream = stream;
      this.#wireStream(connectionId, stream);

      const symbols = Array.from(this.#subscriptions.get(connectionId)?.keys() ?? []);
      if (symbols.length > 0) {
        stream.subscribe('bars', symbols);
      }
      this.emit('resubscribed', {connectionId, symbols});
    } catch (error) {
      console.error(`Reconnect failed permanently for "${connectionId}".`, error);
      this.emit('reconnect_failed', {connectionId, error});
    }
  }

  async connect(credentials: AlpacaStreamCredentials, source: string): Promise<AlpacaConnection> {
    const singletonKey = `${credentials.apiKey}:${source}`;
    const existingConnectionId = this.#credentialToConnectionId.get(singletonKey);
    if (existingConnectionId) {
      const existing = this.#connections.get(existingConnectionId);
      if (existing) {
        return existing;
      }
    }

    const connectionId = crypto.randomUUID();
    const stream = await retry(() => this.#openStream(credentials, source, connectionId), this.#retryConfig);

    const connection: AlpacaConnection = {connectionId, stream};
    this.#connections.set(connectionId, connection);
    this.#credentialToConnectionId.set(singletonKey, connectionId);
    this.#connectionParams.set(connectionId, {credentials, source});
    this.#wireStream(connectionId, stream);

    return connection;
  }

  /**
   * Bars from Alpaca come in minutes:
   * https://docs.alpaca.markets/docs/real-time-stock-pricing-data#minute-bars-bars
   */
  subscribeToBars(connectionId: string, symbol: string, cb: (bar: MinuteBarMessage) => void) {
    const connection = this.#connections.get(connectionId);
    if (!connection) {
      console.warn(`No connection found for "${connectionId}".`);
      return;
    }

    let subscriptions = this.#subscriptions.get(connectionId);
    if (!subscriptions) {
      subscriptions = new Map();
      this.#subscriptions.set(connectionId, subscriptions);
    }

    let callbacks = subscriptions.get(symbol);
    if (!callbacks) {
      callbacks = new Set();
      subscriptions.set(symbol, callbacks);
    }
    callbacks.add(cb);

    const allSymbols = Array.from(subscriptions.keys());
    this.#sendSubscriptionUpdate(connection, stream => {
      stream.unsubscribe('bars', allSymbols);
      stream.subscribe('bars', allSymbols);
    });
  }

  unsubscribeFromBars(connectionId: string, symbol: string) {
    const connection = this.#connections.get(connectionId);
    if (!connection) {
      return;
    }

    this.#subscriptions.get(connectionId)?.delete(symbol);

    this.#sendSubscriptionUpdate(connection, stream => {
      stream.unsubscribe('bars', [symbol]);
    });
  }

  /**
   * Subscription updates go over the wire, and during a reconnect window the current
   * stream may already be closed — `WebSocket#send` then throws, which would crash the
   * host process. Swallowing the failure is safe: the reconnect path resubscribes every
   * tracked symbol from `#subscriptions` once the fresh stream is authenticated.
   */
  #sendSubscriptionUpdate(connection: AlpacaConnection, update: (stream: AlpacaStream) => void) {
    try {
      update(connection.stream);
    } catch (error) {
      console.warn(`Subscription update on "${connection.connectionId}" deferred to reconnect:`, error);
    }
  }

  disconnect(connectionId: string) {
    const connection = this.#connections.get(connectionId);
    if (!connection) {
      return;
    }

    this.#intentionalCloses.add(connectionId);
    connection.stream.close();

    this.#connections.delete(connectionId);
    this.#subscriptions.delete(connectionId);
    this.#connectionParams.delete(connectionId);
    for (const [singletonKey, id] of this.#credentialToConnectionId) {
      if (id === connectionId) {
        this.#credentialToConnectionId.delete(singletonKey);
      }
    }
  }
}

// Module-level singleton
export const alpacaWebSocket = new AlpacaWebSocket();
