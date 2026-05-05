import {ms} from 'ms';
import {retry, RetryConfig} from 'ts-retry-promise';
import {AlpacaStream, type AlpacaStreamCredentials} from './api/AlpacaStream.js';
import type {MinuteBarMessage, StreamMessage} from './api/schema/StreamSchema.js';

const hasErrorCode = (error: unknown): error is {code: string | number} => {
  return !!error && typeof error === 'object' && 'code' in error;
};

export interface AlpacaConnection {
  connectionId: string;
}

interface InternalConnection extends AlpacaConnection {
  stream: AlpacaStream;
}

interface BarHandler {
  symbol: string;
  callback: (bar: MinuteBarMessage) => void;
}

/**
 * Alpaca only allows 1 WebSocket connection per API key. This class manages
 * WebSocket connections as singletons to avoid the following error:
 * {"T":"error","code":406,"msg":"connection limit exceeded"}
 *
 * If a previously authenticated stream drops (`close` event), the connection is
 * re-established under the same `connectionId` and all tracked subscriptions and
 * bar handlers are re-installed on the new stream. Callers keep using the same
 * connectionId across reconnects.
 */
class AlpacaWebSocket {
  #connections: Map<string, InternalConnection> = new Map();
  #symbols: Map<string, Set<string>> = new Map();
  #barHandlers: Map<string, BarHandler[]> = new Map();
  #connectionMeta: Map<string, {credentials: AlpacaStreamCredentials; source: string}> = new Map();
  #credentialToConnectionId: Map<string, string> = new Map();

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

  async #establishConnection(
    credentials: AlpacaStreamCredentials,
    source: string,
    reuseConnectionId?: string
  ): Promise<InternalConnection> {
    const singletonKey = `${credentials.apiKey}:${source}`;

    // Initial connect: reuse the existing connection if one already exists for these
    // credentials. Reconnect path: skip the cache (the existing entry points at the
    // dead stream we're replacing).
    if (!reuseConnectionId) {
      const existingConnectionId = this.#credentialToConnectionId.get(singletonKey);
      if (existingConnectionId) {
        const existing = this.#connections.get(existingConnectionId);
        if (existing) {
          return existing;
        }
      }
    }

    const connectionId = reuseConnectionId ?? crypto.randomUUID();

    return new Promise<InternalConnection>((resolve, reject) => {
      const stream = new AlpacaStream(credentials, source);

      const onPreAuthError = (error: unknown) => {
        console.error(`WebSocket streaming failed for ID "${connectionId}".`, error);
        reject(error);
      };
      const onPreAuthClose = () => {
        // Server can drop the connection before sending an auth response. Without this,
        // the surrounding `retry()` would hang forever.
        reject(new Error(`WebSocket closed before authentication for ID "${connectionId}".`));
      };

      stream.on('error', onPreAuthError);
      stream.on('close', onPreAuthClose);

      stream.on('subscription', (message: unknown) => {
        console.log(`WebSocket streaming is subscribed with ID "${connectionId}":`, JSON.stringify(message));
      });

      stream.on('authenticated', () => {
        console.log(`WebSocket streaming is authenticated with ID "${connectionId}".`);
        stream.off('error', onPreAuthError);
        stream.off('close', onPreAuthClose);

        const connection = {connectionId, stream};
        this.#connections.set(connectionId, connection);
        this.#credentialToConnectionId.set(singletonKey, connectionId);
        this.#connectionMeta.set(connectionId, {credentials, source});

        // Post-auth: errors are message-level (e.g. server T:error) and shouldn't
        // reject the already-resolved promise. Log them — and note that 405/409 codes
        // returned for a re-subscribe are silently observed here, so the reconnect
        // success log explicitly says "awaiting confirmation" rather than "done".
        stream.on('error', (error: unknown) => {
          console.error(`WebSocket streaming error after auth for ID "${connectionId}".`, error);
        });
        stream.once('close', () => {
          // Skip if the caller has torn this connection down via disconnect().
          if (!this.#connectionMeta.has(connectionId)) {
            return;
          }
          console.warn(`WebSocket closed for ID "${connectionId}", attempting to reconnect.`);
          void this.#reconnect(connectionId);
        });

        resolve(connection);
      });
    });
  }

  async #reconnect(connectionId: string): Promise<void> {
    const meta = this.#connectionMeta.get(connectionId);
    if (!meta) {
      // Caller called disconnect() in between the close event and this reconnect tick.
      return;
    }
    try {
      await retry(
        () => this.#establishConnection(meta.credentials, meta.source, connectionId),
        this.#retryConfig
      );
      const connection = this.#connections.get(connectionId);
      if (!connection) {
        return;
      }
      const handlers = this.#barHandlers.get(connectionId) ?? [];
      for (const handler of handlers) {
        this.#attachBarHandler(connection, handler);
      }
      const symbols = this.#symbols.get(connectionId);
      if (symbols && symbols.size > 0) {
        connection.stream.subscribe('bars', Array.from(symbols));
      }
      // Note: a 405 (symbol limit) or 409 (insufficient subscription) response to the
      // resubscribe arrives as a post-auth `error` and is logged but doesn't fail this
      // method. The "subscriptions resent" wording is deliberate — the actual confirmation
      // appears as a separate `WebSocket streaming is subscribed` log line.
      console.log(
        `WebSocket reconnected for ID "${connectionId}"; resent ${handlers.length} handler(s) and ${symbols?.size ?? 0} subscription(s) — awaiting confirmation.`
      );
    } catch (error) {
      console.error(
        `WebSocket reconnect permanently failed for ID "${connectionId}", evicting connection.`,
        error
      );
      this.#evict(connectionId);
    }
  }

  #attachBarHandler(connection: InternalConnection, handler: BarHandler): void {
    connection.stream.on('message', (message: StreamMessage) => {
      if (message.T === 'b' && message.S === handler.symbol) {
        handler.callback(message);
      }
    });
  }

  /**
   * Drop a connection from every internal map and close the underlying stream. After
   * this the close listener that would otherwise trigger reconnect is a no-op (it
   * checks `#connectionMeta` first), and a future `connect()` for the same credentials
   * starts a fresh handshake instead of returning the dead entry.
   */
  #evict(connectionId: string): void {
    const meta = this.#connectionMeta.get(connectionId);
    if (meta) {
      const singletonKey = `${meta.credentials.apiKey}:${meta.source}`;
      this.#credentialToConnectionId.delete(singletonKey);
    }
    this.#connections.delete(connectionId);
    this.#connectionMeta.delete(connectionId);
    this.#symbols.delete(connectionId);
    this.#barHandlers.delete(connectionId);
  }

  /** Tear a connection down for good. Stops the auto-reconnect loop and closes the stream. */
  disconnect(connectionId: string): void {
    const connection = this.#connections.get(connectionId);
    // Evict first so the close listener installed in #establishConnection sees an empty
    // meta entry and skips the reconnect path.
    this.#evict(connectionId);
    connection?.stream.close();
  }

  async connect(credentials: AlpacaStreamCredentials, source: string): Promise<AlpacaConnection> {
    const connection = await retry(() => this.#establishConnection(credentials, source), this.#retryConfig);
    return {connectionId: connection.connectionId};
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

    // Track symbols per connection
    let symbols = this.#symbols.get(connectionId);
    if (!symbols) {
      symbols = new Set();
      this.#symbols.set(connectionId, symbols);
    }
    symbols.add(symbol);

    // Track the callback so it can be re-attached on reconnect.
    let handlers = this.#barHandlers.get(connectionId);
    if (!handlers) {
      handlers = [];
      this.#barHandlers.set(connectionId, handlers);
    }
    const handler: BarHandler = {symbol, callback: cb};
    handlers.push(handler);
    this.#attachBarHandler(connection, handler);

    const allSymbols = Array.from(symbols);
    connection.stream.unsubscribe('bars', allSymbols);
    connection.stream.subscribe('bars', allSymbols);
  }

  unsubscribeFromBars(connectionId: string, symbol: string) {
    const connection = this.#connections.get(connectionId);
    if (!connection) {
      return;
    }

    const symbols = this.#symbols.get(connectionId);
    symbols?.delete(symbol);

    const handlers = this.#barHandlers.get(connectionId);
    if (handlers) {
      const idx = handlers.findIndex(h => h.symbol === symbol);
      if (idx !== -1) {
        handlers.splice(idx, 1);
      }
    }

    connection.stream.unsubscribe('bars', [symbol]);
  }
}

// Module-level singleton
export const alpacaWebSocket = new AlpacaWebSocket();
