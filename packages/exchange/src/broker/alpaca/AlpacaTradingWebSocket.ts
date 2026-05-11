import {ms} from 'ms';
import {retry, type RetryConfig} from 'ts-retry-promise';
import {AlpacaTradingStream, type AlpacaTradingStreamCredentials} from './api/AlpacaTradingStream.js';
import {TradeUpdateMessageSchema, type TradeUpdateMessage} from './api/schema/TradingStreamSchema.js';

const hasErrorCode = (error: unknown): error is {code: string | number} => {
  return !!error && typeof error === 'object' && 'code' in error;
};

export interface AlpacaTradingConnection {
  connectionId: string;
  stream: AlpacaTradingStream;
}

/**
 * Manages the singleton WebSocket connection for Alpaca trading updates.
 * One connection per API key (account-wide, not per-symbol).
 *
 * @see https://docs.alpaca.markets/docs/websocket-streaming
 */
class AlpacaTradingWebSocket {
  #connections: Map<string, AlpacaTradingConnection> = new Map();
  #credentialToConnectionId: Map<string, string> = new Map();
  #listeners: Map<string, Set<(message: TradeUpdateMessage) => void>> = new Map();

  static readonly #NON_RETRYABLE_CODES = new Set([402, 404, 405, 409]);

  readonly #retryConfig: Partial<RetryConfig> = {
    delay: ms('30s'),
    retries: 'INFINITELY',
    retryIf: (error: unknown) => {
      console.error(`AlpacaTradingWebSocket error: ${error}`);
      if (hasErrorCode(error) && AlpacaTradingWebSocket.#NON_RETRYABLE_CODES.has(Number(error.code))) {
        return false;
      }
      return true;
    },
    timeout: 'INFINITELY',
  } as const;

  async #establishConnection(credentials: AlpacaTradingStreamCredentials): Promise<AlpacaTradingConnection> {
    const singletonKey = credentials.apiKey;
    const existingConnectionId = this.#credentialToConnectionId.get(singletonKey);
    if (existingConnectionId) {
      const existing = this.#connections.get(existingConnectionId);
      if (existing) {
        return existing;
      }
    }

    const connectionId = crypto.randomUUID();

    return new Promise<AlpacaTradingConnection>((resolve, reject) => {
      const stream = new AlpacaTradingStream(credentials);

      stream.on('error', (error: unknown) => {
        console.error(`Trading WebSocket failed for ID "${connectionId}".`, error);
        reject(error);
      });

      stream.on('listening', (message: unknown) => {
        console.log(`Trading WebSocket is listening with ID "${connectionId}":`, JSON.stringify(message));
      });

      stream.on('authenticated', () => {
        console.log(`Trading WebSocket is authenticated with ID "${connectionId}".`);
        const connection = {connectionId, stream};
        this.#connections.set(connectionId, connection);
        this.#credentialToConnectionId.set(singletonKey, connectionId);

        stream.listen(['trade_updates']);

        stream.on('trade_update', (data: unknown) => {
          const parsed = TradeUpdateMessageSchema.safeParse(data);
          if (parsed.success) {
            const listeners = this.#listeners.get(connectionId);
            if (listeners) {
              for (const cb of listeners) {
                cb(parsed.data);
              }
            }
          } else {
            console.warn(`Failed to parse trade update:`, parsed.error);
          }
        });

        resolve(connection);
      });
    });
  }

  async connect(credentials: AlpacaTradingStreamCredentials): Promise<AlpacaTradingConnection> {
    return retry(() => this.#establishConnection(credentials), this.#retryConfig);
  }

  onTradeUpdate(connectionId: string, cb: (message: TradeUpdateMessage) => void) {
    let listeners = this.#listeners.get(connectionId);
    if (!listeners) {
      listeners = new Set();
      this.#listeners.set(connectionId, listeners);
    }
    listeners.add(cb);
  }

  offTradeUpdate(connectionId: string, cb: (message: TradeUpdateMessage) => void) {
    const listeners = this.#listeners.get(connectionId);
    listeners?.delete(cb);
  }

  disconnect(connectionId: string) {
    const connection = this.#connections.get(connectionId);
    if (connection) {
      connection.stream.close();
      this.#connections.delete(connectionId);
      this.#listeners.delete(connectionId);
    }
  }
}

export const alpacaTradingWebSocket = new AlpacaTradingWebSocket();
