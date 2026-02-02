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

/**
 * Alpaca only allows 1 WebSocket connection per API key. This class manages
 * WebSocket connections as singletons to avoid the following error:
 * {"T":"error","code":406,"msg":"connection limit exceeded"}
 */
class AlpacaWebSocket {
  #streams: {[apiKey: string]: AlpacaStream} = {};
  #symbols: {[apiKey: string]: Set<string>} = {};
  readonly #retryConfig: Partial<RetryConfig> = {
    delay: ms('30s'),
    retries: 'INFINITELY',
    retryIf: (error: unknown) => {
      // Usual errors:
      // {"T":"error","code":406,"msg":"connection limit exceeded"}
      // Unexpected server response: 429
      console.error('AlpacaWebSocket error:', error);
      if (hasErrorCode(error) && error.code === 409) {
        // Insufficient subscription, you will have to upgrade your Alpaca plan (from "iex" to "sip")
        return false;
      }
      return true;
    },
    timeout: 'INFINITELY',
  } as const;

  async #establishConnection(credentials: DefaultCredentials): Promise<AlpacaStream> {
    const id = credentials.key;
    return new Promise<AlpacaStream>((resolve, reject) => {
      // This check is a safeguard for cases where "establishConnection" is executed multiple times without being
      // awaited. In this scenario the Promise can resolve if it detects that another running Promise has established
      // already a connection.
      const stream = this.#getStream(credentials.key);

      if (stream) {
        resolve(stream);
      }

      const connection = new AlpacaStream({
        credentials,
        source: 'iex',
        type: 'market_data',
      });

      connection.on('error', (error: Message) => {
        console.error(`WebSocket streaming failed for "${id}".`, error);
        reject(error);
      });

      connection.on('subscription', (message: Message) => {
        console.log(`WebSocket streaming is subscribed for "${id}":`, JSON.stringify(message));
      });

      connection.on('authenticated', () => {
        console.log(`WebSocket streaming is authenticated for "${id}".`);
        this.#addStream(credentials.key, connection);
        resolve(connection);
      });
    });
  }

  async connect(credentials: DefaultCredentials): Promise<AlpacaStream> {
    return retry(() => this.#establishConnection(credentials), this.#retryConfig);
  }

  #addStream(apiKey: string, stream: AlpacaStream) {
    this.#streams[apiKey] = stream;
  }

  #getStream(apiKey: string): AlpacaStream | null {
    if (this.#streams[apiKey]) {
      return this.#streams[apiKey];
    }
    return null;
  }

  #addSymbol(apiKey: string, symbol: string): void {
    const symbols = this.#symbols[apiKey];

    if (symbols) {
      symbols.add(symbol);
    } else {
      const set = new Set<string>();
      set.add(symbol);
      this.#symbols[apiKey] = set;
    }
  }

  #removeSymbol(apiKey: string, symbol: string) {
    const symbols = this.#symbols[apiKey];
    symbols?.delete(symbol);
  }

  #getSymbols(apiKey: string): string[] | null {
    const symbols = this.#symbols[apiKey];
    if (symbols) {
      return Array.from(symbols);
    }
    return null;
  }

  /**
   * Bars from Alpaca come in minutes:
   * https://docs.alpaca.markets/docs/real-time-stock-pricing-data#minute-bars-bars
   */
  subscribeToBars(apiKey: string, stream: AlpacaStream, symbol: string, cb: (bar: MinuteBarMessage) => void) {
    this.#addSymbol(apiKey, symbol);
    const symbols = this.#getSymbols(apiKey);
    if (symbols) {
      stream.on('message', (message: StreamMessage) => {
        if (message.T === 'b' && message.S === symbol) {
          cb(message);
        }
      });

      stream.unsubscribe('bars', symbols);
      stream.subscribe('bars', symbols);
    }
  }

  unsubscribeFromBars(apiKey: string, symbol: string) {
    this.#removeSymbol(apiKey, symbol);
    const stream = this.#getStream(apiKey);
    if (stream) {
      stream.unsubscribe('bars', [symbol]);
    }
  }
}

// Module-level singleton
export const alpacaWebSocket = new AlpacaWebSocket();
