import {
  AlpacaStream,
  type DefaultCredentials,
  type Message,
  // @ts-ignore:next-line
} from 'alpaca-legacy';
import {ms} from 'ms';
import {retry, RetryConfig} from 'ts-retry-promise';
import {hasErrorCode} from './AlpacaExchange.js';
import type {MinuteBarMessage, StreamMessage} from './typings.js';

export interface AlpacaConnection {
  connectionId: string;
  stream: AlpacaStream;
}

/**
 * Alpaca only allows 1 WebSocket connection per API key. This class manages
 * WebSocket connections as singletons to avoid the following error:
 * {"T":"error","code":406,"msg":"connection limit exceeded"}
 */
class AlpacaWebSocket {
  #connections: Map<string, AlpacaConnection> = new Map();
  #symbols: Map<string, Set<string>> = new Map();
  #credentialToConnectionId: Map<string, string> = new Map();

  readonly #retryConfig: Partial<RetryConfig> = {
    delay: ms('30s'),
    retries: 'INFINITELY',
    retryIf: (error: unknown) => {
      // Usual errors:
      // {"T":"error","code":406,"msg":"connection limit exceeded"}
      // Unexpected server response: 429
      console.error(`AlpacaWebSocket error: ${error}`);
      if (hasErrorCode(error) && error.code === 409) {
        // Insufficient subscription, you will have to upgrade your Alpaca plan (from "iex" to "sip")
        return false;
      }
      return true;
    },
    timeout: 'INFINITELY',
  } as const;

  async #establishConnection(credentials: DefaultCredentials): Promise<AlpacaConnection> {
    // Check if we already have a connection for these credentials
    const existingConnectionId = this.#credentialToConnectionId.get(credentials.key);
    if (existingConnectionId) {
      const existing = this.#connections.get(existingConnectionId);
      if (existing) {
        return existing;
      }
    }

    const connectionId = crypto.randomUUID();

    return new Promise<AlpacaConnection>((resolve, reject) => {
      const stream = new AlpacaStream({
        credentials,
        source: 'iex',
        type: 'market_data',
      });

      stream.on('error', (error: Message) => {
        console.error(`WebSocket streaming failed for ID "${connectionId}".`, error);
        reject(error);
      });

      stream.on('subscription', (message: Message) => {
        console.log(`WebSocket streaming is subscribed with ID "${connectionId}":`, JSON.stringify(message));
      });

      stream.on('authenticated', () => {
        console.log(`WebSocket streaming is authenticated with ID "${connectionId}".`);
        const connection = {connectionId, stream};
        this.#connections.set(connectionId, connection);
        this.#credentialToConnectionId.set(credentials.key, connectionId);
        resolve(connection);
      });
    });
  }

  async connect(credentials: DefaultCredentials): Promise<AlpacaConnection> {
    return retry(() => this.#establishConnection(credentials), this.#retryConfig);
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
