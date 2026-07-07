import type {EventEmitter} from 'node:events';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {MinuteBarMessage} from './api/schema/StreamSchema.js';

interface FakeStream extends EventEmitter {
  close: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
  unsubscribe: ReturnType<typeof vi.fn>;
}

const fakeStreams = vi.hoisted(() => ({instances: [] as unknown[]}));

vi.mock('./api/AlpacaStream.js', async () => {
  const {EventEmitter} = await import('node:events');

  class FakeAlpacaStream extends EventEmitter {
    close = vi.fn(() => {
      queueMicrotask(() => this.emit('close', this));
    });
    subscribe = vi.fn();
    unsubscribe = vi.fn();

    constructor() {
      super();
      fakeStreams.instances.push(this);
      // The real stream authenticates asynchronously after the socket opens
      queueMicrotask(() => this.emit('authenticated', this));
    }
  }

  return {AlpacaStream: FakeAlpacaStream};
});

const {alpacaWebSocket} = await import('./AlpacaWebSocket.js');

function getStream(index: number): FakeStream {
  const stream = fakeStreams.instances[index];
  if (!stream) {
    throw new Error(`No fake stream at index ${index}.`);
  }
  return stream as FakeStream;
}

function createBar(symbol: string): MinuteBarMessage {
  return {c: 100, h: 101, l: 99, n: 10, o: 100, S: symbol, T: 'b', t: '2025-01-15T14:30:00Z', v: 1_000, vw: 100};
}

/** Each test uses fresh credentials so the singleton-per-`apiKey:source` map never reuses a prior connection. */
function createCredentials() {
  return {apiKey: crypto.randomUUID(), apiSecret: 'test-secret', usePaperTrading: true};
}

async function flushMicrotasks(): Promise<void> {
  await new Promise(resolve => {
    setTimeout(resolve, 0);
  });
}

describe('alpacaWebSocket', {concurrent: false}, () => {
  beforeEach(() => {
    fakeStreams.instances.length = 0;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    alpacaWebSocket.removeAllListeners();
    vi.restoreAllMocks();
  });

  describe('connect', () => {
    it('reuses the existing connection for the same credentials and source', async () => {
      const credentials = createCredentials();

      const first = await alpacaWebSocket.connect(credentials, 'v2/iex');
      const second = await alpacaWebSocket.connect(credentials, 'v2/iex');

      expect(second.connectionId).toBe(first.connectionId);
      expect(fakeStreams.instances).toHaveLength(1);
    });
  });

  describe('reconnect', () => {
    it('reconnects and resubscribes prior bar topics after an unexpected close', async () => {
      const connection = await alpacaWebSocket.connect(createCredentials(), 'v2/iex');
      alpacaWebSocket.subscribeToBars(connection.connectionId, 'AAPL', vi.fn());
      alpacaWebSocket.subscribeToBars(connection.connectionId, 'TSLA', vi.fn());

      const onReconnecting = vi.fn();
      const onResubscribed = vi.fn();
      alpacaWebSocket.on('reconnecting', onReconnecting);
      alpacaWebSocket.on('resubscribed', onResubscribed);

      const firstStream = getStream(0);
      firstStream.emit('close', firstStream);

      await vi.waitFor(() => {
        expect(onResubscribed).toHaveBeenCalledTimes(1);
      });

      expect(onReconnecting).toHaveBeenCalledWith({connectionId: connection.connectionId});
      expect(onResubscribed).toHaveBeenCalledWith({connectionId: connection.connectionId, symbols: ['AAPL', 'TSLA']});

      const secondStream = getStream(1);
      expect(secondStream).not.toBe(firstStream);
      expect(secondStream.subscribe).toHaveBeenCalledWith('bars', ['AAPL', 'TSLA']);
    });

    it('keeps emitting bars to existing subscribers after a reconnect', async () => {
      const connection = await alpacaWebSocket.connect(createCredentials(), 'v2/iex');
      const onBar = vi.fn();
      alpacaWebSocket.subscribeToBars(connection.connectionId, 'AAPL', onBar);

      const onResubscribed = vi.fn();
      alpacaWebSocket.on('resubscribed', onResubscribed);
      const firstStream = getStream(0);
      firstStream.emit('close', firstStream);
      await vi.waitFor(() => {
        expect(onResubscribed).toHaveBeenCalledTimes(1);
      });

      getStream(1).emit('message', createBar('AAPL'));

      expect(onBar).toHaveBeenCalledTimes(1);
    });

    it('never calls process.exit when the socket drops', async () => {
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit must not be called');
      });

      const onResubscribed = vi.fn();
      alpacaWebSocket.on('resubscribed', onResubscribed);
      await alpacaWebSocket.connect(createCredentials(), 'v2/iex');

      const firstStream = getStream(0);
      firstStream.emit('close', firstStream);
      await vi.waitFor(() => {
        expect(onResubscribed).toHaveBeenCalledTimes(1);
      });

      expect(exitSpy).not.toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('does not reconnect after an intentional disconnect', async () => {
      const connection = await alpacaWebSocket.connect(createCredentials(), 'v2/iex');
      const onReconnecting = vi.fn();
      alpacaWebSocket.on('reconnecting', onReconnecting);

      alpacaWebSocket.disconnect(connection.connectionId);
      await flushMicrotasks();
      await flushMicrotasks();

      expect(getStream(0).close).toHaveBeenCalledTimes(1);
      expect(onReconnecting).not.toHaveBeenCalled();
      expect(fakeStreams.instances).toHaveLength(1);
    });
  });

  describe('subscribeToBars', () => {
    it('emits exactly one candle per message after a subscribe/unsubscribe/subscribe cycle', async () => {
      const connection = await alpacaWebSocket.connect(createCredentials(), 'v2/iex');
      const stream = getStream(0);

      const firstCallback = vi.fn();
      alpacaWebSocket.subscribeToBars(connection.connectionId, 'AAPL', firstCallback);
      stream.emit('message', createBar('AAPL'));
      expect(firstCallback).toHaveBeenCalledTimes(1);

      alpacaWebSocket.unsubscribeFromBars(connection.connectionId, 'AAPL');
      const secondCallback = vi.fn();
      alpacaWebSocket.subscribeToBars(connection.connectionId, 'AAPL', secondCallback);
      stream.emit('message', createBar('AAPL'));

      expect(secondCallback).toHaveBeenCalledTimes(1);
      expect(firstCallback).toHaveBeenCalledTimes(1);
    });

    it('only dispatches bars to callbacks of the matching symbol', async () => {
      const connection = await alpacaWebSocket.connect(createCredentials(), 'v2/iex');
      const onAppleBar = vi.fn();
      alpacaWebSocket.subscribeToBars(connection.connectionId, 'AAPL', onAppleBar);

      getStream(0).emit('message', createBar('TSLA'));

      expect(onAppleBar).not.toHaveBeenCalled();
    });

    it('survives subscription updates while the underlying socket is closed', async () => {
      const connection = await alpacaWebSocket.connect(createCredentials(), 'v2/iex');
      const stream = getStream(0);
      const closedSocketError = new Error('WebSocket is not open');
      stream.subscribe.mockImplementation(() => {
        throw closedSocketError;
      });
      stream.unsubscribe.mockImplementation(() => {
        throw closedSocketError;
      });

      const callback = vi.fn();
      expect(() => alpacaWebSocket.subscribeToBars(connection.connectionId, 'AAPL', callback)).not.toThrow();
      expect(() => alpacaWebSocket.unsubscribeFromBars(connection.connectionId, 'AAPL')).not.toThrow();
    });
  });
});
