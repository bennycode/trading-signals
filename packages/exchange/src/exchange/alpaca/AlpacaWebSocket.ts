import {ms} from 'ms';
import {retry, RetryConfig} from 'ts-retry-promise';
import {AlpacaStream, type AlpacaStreamCredentials} from './api/AlpacaStream.js';
import type {MinuteBarMessage, StreamMessage} from './api/schema/StreamSchema.js';

const hasErrorCode = (error: unknown): error is {code: string | number} => {
  return !!error && typeof error === 'object' && 'code' in error;
};

export interface AlpacaConnection {
  connectionId: string;
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
  #connections: Map<string, AlpacaConnection> = new Map();
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
  ): Promise<AlpacaConnection> {
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

    return new Promise<AlpacaConnection>((resolve, reject) => {
      const stream = new AlpacaStream(credentials, source);

      stream.on('error', (error: unknown) => {
        console.error(`WebSocket streaming failed for ID "${connectionId}".`, error);
        reject(error);
      });

      stream.on('subscription', (message: unknown) => {
        console.log(`WebSocket streaming is subscribed with ID "${connectionId}":`, JSON.stringify(message));
      });

      stream.on('authenticated', () => {
        console.log(`WebSocket streaming is authenticated with ID "${connectionId}".`);
        const connection = {connectionId, stream};
        this.#connections.set(connectionId, connection);
        this.#credentialToConnectionId.set(singletonKey, connectionId);
        this.#connectionMeta.set(connectionId, {credentials, source});

        // Replace the rejection-on-error handler with a logging-only handler. Errors
        // after auth are message-level and shouldn't reject the (already-resolved)
        // promise. If they're paired with a transport drop, the close listener below
        // triggers reconnect.
        stream.removeAllListeners('error');
        stream.on('error', (error: unknown) => {
          console.error(`WebSocket streaming error after auth for ID "${connectionId}".`, error);
        });
        stream.once('close', () => {
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
      console.warn(`No reconnect metadata for ID "${connectionId}", skipping reconnect.`);
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
      console.log(
        `WebSocket reconnected for ID "${connectionId}" with ${handlers.length} handler(s) and ${symbols?.size ?? 0} subscription(s).`
      );
    } catch (error) {
      console.error(`WebSocket reconnect permanently failed for ID "${connectionId}".`, error);
    }
  }

  #attachBarHandler(connection: AlpacaConnection, handler: BarHandler): void {
    connection.stream.on('message', (message: StreamMessage) => {
      if (message.T === 'b' && message.S === handler.symbol) {
        handler.callback(message);
      }
    });
  }

  async connect(credentials: AlpacaStreamCredentials, source: string): Promise<AlpacaConnection> {
    return retry(() => this.#establishConnection(credentials, source), this.#retryConfig);
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
