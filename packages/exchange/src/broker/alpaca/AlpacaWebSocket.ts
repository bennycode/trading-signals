import {ms} from 'ms';
import {retry, RetryConfig} from 'ts-retry-promise';
import {AlpacaStream, type AlpacaStreamCloseInfo, type AlpacaStreamCredentials} from './api/AlpacaStream.js';
import type {MinuteBarMessage, StreamMessage} from './api/schema/StreamSchema.js';

const hasErrorCode = (error: unknown): error is {code: string | number} => {
  return !!error && typeof error === 'object' && 'code' in error;
};

export interface AlpacaConnection {
  connectionId: string;
  stream: AlpacaStream;
}

/**
 * Payload passed to the optional {@link AlpacaWebSocket.onClose} handler when the
 * market-data stream drops. The handler runs before `process.exit(1)` so operators
 * can be notified (e.g. via Telegram) which connection died and why.
 */
export interface AlpacaWebSocketCloseInfo extends AlpacaStreamCloseInfo {
  connectionId: string;
}

/** How long the close handler waits for `onClose` before forcing the process exit. */
const ON_CLOSE_DEADLINE_MS = 2_000;

/**
 * Alpaca only allows 1 WebSocket connection per API key. This class manages
 * WebSocket connections as singletons to avoid the following error:
 * {"T":"error","code":406,"msg":"connection limit exceeded"}
 */
class AlpacaWebSocket {
  #connections: Map<string, AlpacaConnection> = new Map();
  #symbols: Map<string, Set<string>> = new Map();
  #credentialToConnectionId: Map<string, string> = new Map();

  /**
   * Optional observability hook. Invoked just before {@link process.exit} when a
   * market-data stream closes, so callers (typically the messaging layer at
   * application startup) can surface an alert. Awaited with a {@link ON_CLOSE_DEADLINE_MS}
   * deadline so a hung handler can't block the exit — the bug being instrumented
   * here is "process stops emitting any signal," so the worst case is to lose the
   * notification, not to lose the exit.
   */
  onClose?: (info: AlpacaWebSocketCloseInfo) => Promise<void> | void;

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

  async #establishConnection(credentials: AlpacaStreamCredentials, source: string): Promise<AlpacaConnection> {
    // Check if we already have a connection for these credentials + source
    const singletonKey = `${credentials.apiKey}:${source}`;
    const existingConnectionId = this.#credentialToConnectionId.get(singletonKey);
    if (existingConnectionId) {
      const existing = this.#connections.get(existingConnectionId);
      if (existing) {
        return existing;
      }
    }

    const connectionId = crypto.randomUUID();

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

        /**
         * Every close on this socket is currently a failure (transport drop).
         * In this case, we do a hard-exit so the orchestrator restarts the stream.
         * Before exiting we (1) log the close code / reason / wasClean — which the
         * underlying `error` event throws away — and (2) give `onClose` a bounded
         * window to fire an alert so operators learn about the drop without having
         * to tail dokku logs.
         */
        stream.once('close', async (_stream: AlpacaStream, info: AlpacaStreamCloseInfo | undefined) => {
          const closeInfo: AlpacaWebSocketCloseInfo = {
            connectionId,
            code: info?.code ?? 0,
            reason: info?.reason ?? '',
            wasClean: info?.wasClean ?? false,
          };
          console.error(
            `Market-data WebSocket closed for "${connectionId}" (code=${closeInfo.code}, reason="${closeInfo.reason}", wasClean=${closeInfo.wasClean}). Exiting so the orchestrator restarts the stream.`
          );
          if (this.onClose) {
            await Promise.race([
              Promise.resolve(this.onClose(closeInfo)).catch(error => {
                console.error('AlpacaWebSocket onClose handler threw', error);
              }),
              new Promise<void>(resolve => setTimeout(resolve, ON_CLOSE_DEADLINE_MS).unref()),
            ]);
          }
          process.exit(1);
        });

        resolve(connection);
      });
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

    connection.stream.on('message', (message: StreamMessage) => {
      if (message.T === 'b' && message.S === symbol) {
        cb(message);
      }
    });

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

    connection.stream.unsubscribe('bars', [symbol]);
  }
}

// Module-level singleton
export const alpacaWebSocket = new AlpacaWebSocket();
