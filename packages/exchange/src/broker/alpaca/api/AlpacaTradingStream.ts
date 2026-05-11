import {EventEmitter} from 'node:events';

export interface AlpacaTradingStreamCredentials {
  apiKey: string;
  apiSecret: string;
  usePaperTrading: boolean;
}

/**
 * Alpaca trading WebSocket stream for real-time order updates using Node.js native WebSocket.
 *
 * @see https://docs.alpaca.markets/docs/websocket-streaming
 */
export class AlpacaTradingStream extends EventEmitter {
  readonly #connection: WebSocket;
  #authenticated = false;

  constructor(credentials: AlpacaTradingStreamCredentials) {
    super();

    /** @see https://docs.alpaca.markets/docs/websocket-streaming */
    const host = credentials.usePaperTrading ? 'paper-api.alpaca.markets' : 'api.alpaca.markets';
    const url = `wss://${host}/stream`;
    this.#connection = new WebSocket(url);

    // Trading stream uses binary frames
    this.#connection.binaryType = 'arraybuffer';

    this.#connection.addEventListener('open', () => {
      this.#connection.send(
        JSON.stringify({
          action: 'auth',
          key: credentials.apiKey,
          secret: credentials.apiSecret,
        })
      );
    });

    this.#connection.addEventListener('message', event => {
      const text = typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data);
      const message: unknown = JSON.parse(text);
      this.emit('message', message);

      if (isStreamMessage(message)) {
        if (message.stream === 'authorization' && message.data?.status === 'authorized') {
          this.#authenticated = true;
          this.emit('authenticated', this);
        } else if (message.stream === 'listening') {
          this.emit('listening', message);
        } else if (message.stream === 'trade_updates') {
          this.emit('trade_update', message.data);
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

  listen(streams: string[]) {
    this.#send({action: 'listen', data: {streams}});
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

function isStreamMessage(value: unknown): value is {stream: string; data?: Record<string, unknown>} {
  return !!value && typeof value === 'object' && 'stream' in value;
}
