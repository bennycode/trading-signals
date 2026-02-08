import {EventEmitter} from 'node:events';

export interface AlpacaStreamCredentials {
  key: string;
  paper?: boolean;
  secret: string;
}

/**
 * Alpaca market data WebSocket stream using Node.js native WebSocket.
 *
 * @see https://docs.alpaca.markets/docs/real-time-stock-pricing-data
 */
export class AlpacaStream extends EventEmitter {
  readonly #connection: WebSocket;
  #authenticated = false;

  constructor(credentials: AlpacaStreamCredentials, source: string) {
    super();

    const url = `wss://stream.data.alpaca.markets/${source}`;
    this.#connection = new WebSocket(url);

    this.#connection.addEventListener('open', () => {
      this.#connection.send(JSON.stringify({
        action: 'auth',
        key: credentials.key,
        secret: credentials.secret,
      }));
    });

    this.#connection.addEventListener('message', event => {
      const messages: unknown[] = JSON.parse(String(event.data));

      for (const message of messages) {
        this.emit('message', message);

        if (isTypedMessage(message)) {
          if (message.T === 'success' && message.msg === 'authenticated') {
            this.#authenticated = true;
            this.emit('authenticated', this);
          } else if (message.T === 'subscription') {
            this.emit('subscription', message);
          } else if (message.T === 'error') {
            this.emit('error', message);
          }
        }
      }
    });

    this.#connection.addEventListener('error', event => {
      this.emit('error', event);
    });

    this.#connection.addEventListener('close', () => {
      this.emit('close', this);
    });
  }

  subscribe(channel: string, symbols: string[]) {
    this.#send({action: 'subscribe', [channel]: symbols});
  }

  unsubscribe(channel: string, symbols: string[]) {
    this.#send({action: 'unsubscribe', [channel]: symbols});
  }

  close() {
    this.#connection.close();
  }

  #send(message: Record<string, unknown>) {
    if (!this.#authenticated) {
      throw new Error('Not authenticated');
    }
    this.#connection.send(JSON.stringify(message));
  }
}

function isTypedMessage(value: unknown): value is {T: string; msg?: string} {
  return !!value && typeof value === 'object' && 'T' in value;
}
