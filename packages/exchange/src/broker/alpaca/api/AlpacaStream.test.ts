import {AlpacaStream} from './AlpacaStream.js';

describe('AlpacaStream', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('connects to the regular market data stream host', () => {
    const urls: string[] = [];
    vi.stubGlobal(
      'WebSocket',
      class {
        constructor(url: string) {
          urls.push(url);
        }

        addEventListener() {}
      }
    );

    new AlpacaStream({apiKey: 'test', apiSecret: 'test'}, 'v2/iex');

    expect(urls, 'paper keys fail auth on the sandbox stream host').toEqual([
      'wss://stream.data.alpaca.markets/v2/iex',
    ]);
  });
});
