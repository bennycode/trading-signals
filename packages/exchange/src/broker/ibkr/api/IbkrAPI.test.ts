import {createServer, type IncomingMessage, type Server, type ServerResponse} from 'node:http';
import type {AddressInfo} from 'node:net';
import {afterEach, describe, expect, it} from 'vitest';
import {IbkrAPI} from './IbkrAPI.js';

type Handler = (req: IncomingMessage, res: ServerResponse) => void;

/**
 * A throwaway gateway on an ephemeral port, driven by a handler the test supplies. Every response
 * carries `Connection: close` so no keep-alive socket outlives the request, which would otherwise
 * leave {@link Server.close} waiting.
 */
async function startGateway(handler: Handler): Promise<{server: Server; url: string}> {
  const server = createServer((req, res) => {
    req.resume();
    res.setHeader('content-type', 'application/json');
    res.setHeader('connection', 'close');
    handler(req, res);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const {port} = server.address() as AddressInfo;
  return {server, url: `http://127.0.0.1:${port}`};
}

function noBridge(res: ServerResponse): void {
  res.statusCode = 400;
  res.end(JSON.stringify({error: 'Bad Request: no bridge', statusCode: 400}));
}

describe('IbkrAPI dropped-bridge recovery', () => {
  let running: Server | undefined;

  afterEach(async () => {
    const server = running;
    running = undefined;
    if (server) {
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });

  it('re-opens the session and retries when the bridge has dropped', async () => {
    let bridgeUp = false;
    let reopens = 0;
    let accountsCalls = 0;

    const {server, url} = await startGateway((req, res) => {
      if (req.url === IbkrAPI.URL.SESSION_INIT) {
        reopens += 1;
        bridgeUp = true;
        res.end(JSON.stringify({authenticated: true}));
        return;
      }
      if (req.url === IbkrAPI.URL.ACCOUNTS) {
        accountsCalls += 1;
        if (bridgeUp) {
          res.end(JSON.stringify({accounts: ['U1234567']}));
        } else {
          noBridge(res);
        }
        return;
      }
      res.statusCode = 404;
      res.end('{}');
    });
    running = server;

    const accounts = await new IbkrAPI({gatewayUrl: url}).getAccounts();

    expect(accounts.accounts, 'the retry after re-opening the bridge returns the real answer').toEqual(['U1234567']);
    expect(reopens, 'the session is opened once, not on every call').toBe(1);
    expect(accountsCalls, 'the first call hits no bridge and the retry succeeds').toBe(2);
  });

  it('gives up rather than loop when re-opening does not restore the bridge', async () => {
    let reopens = 0;

    const {server, url} = await startGateway((req, res) => {
      if (req.url === IbkrAPI.URL.SESSION_INIT) {
        reopens += 1;
        res.end(JSON.stringify({authenticated: true}));
        return;
      }
      // Never actually restores the bridge, so every retry still finds it gone.
      noBridge(res);
    });
    running = server;

    await expect(
      new IbkrAPI({gatewayUrl: url}).getAccounts(),
      'a bridge that will not come back surfaces as an error rather than a hang'
    ).rejects.toThrow(/no bridge/i);

    expect(reopens, 'it re-opens at most once before giving up, so it cannot spin').toBe(1);
  });

  it('passes an ordinary error straight through without re-opening', async () => {
    let reopens = 0;

    const {server, url} = await startGateway((req, res) => {
      if (req.url === IbkrAPI.URL.SESSION_INIT) {
        reopens += 1;
        res.end(JSON.stringify({authenticated: true}));
        return;
      }
      res.statusCode = 404;
      res.end(JSON.stringify({error: 'not found'}));
    });
    running = server;

    await expect(new IbkrAPI({gatewayUrl: url}).getContractInfoAndRules(999)).rejects.toThrow();
    expect(reopens, 'only a no-bridge response triggers a re-open').toBe(0);
  });
});
