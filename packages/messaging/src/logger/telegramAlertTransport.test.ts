import {describe, expect, it, vi} from 'vitest';
import {createTelegramAlertStream} from './telegramAlertTransport.js';

type FetchMock = ReturnType<typeof vi.fn> & typeof fetch;

function writeRecord(stream: ReturnType<typeof createTelegramAlertStream>, record: object): Promise<void> {
  return new Promise(resolve => stream.write(`${JSON.stringify(record)}\n`, 'utf8', () => resolve()));
}

function makeFetchMock(response: Partial<Response> = {ok: true, status: 200, statusText: 'OK'}): FetchMock {
  return vi.fn().mockResolvedValue(response) as FetchMock;
}

const baseOptions = {botToken: 'TEST_TOKEN', chatId: '12345'};

describe('createTelegramAlertStream', () => {
  it('posts level-50 records to the Telegram Bot API with the right body', async () => {
    const fetch = makeFetchMock();
    const stream = createTelegramAlertStream({...baseOptions, fetch});

    await writeRecord(stream, {err: {message: 'oops', type: 'X'}, level: 50, msg: 'Strategy error'});
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    const [url, init] = fetch.mock.calls[0] as [string, {body: string}];
    expect(url).toBe('https://api.telegram.org/botTEST_TOKEN/sendMessage');
    const body = JSON.parse(init.body) as {chat_id: string; text: string};
    expect(body.chat_id).toBe('12345');
    expect(body.text).toContain('🚨 ERROR');
    expect(body.text).toContain('Strategy error');
  });

  it('drops records below the configured level', async () => {
    const fetch = makeFetchMock();
    const stream = createTelegramAlertStream({...baseOptions, fetch, level: 50});

    await writeRecord(stream, {level: 40, msg: 'warn-not-alert'});
    await writeRecord(stream, {level: 30, msg: 'info-not-alert'});

    expect(fetch).not.toHaveBeenCalled();
  });

  it('honours a custom (higher) level threshold', async () => {
    const fetch = makeFetchMock();
    const stream = createTelegramAlertStream({...baseOptions, fetch, level: 60});

    await writeRecord(stream, {level: 50, msg: 'error-but-not-fatal'});
    expect(fetch).not.toHaveBeenCalled();

    await writeRecord(stream, {level: 60, msg: 'fatal'});
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  });

  it('dedups identical structural errors within the window', async () => {
    const fetch = makeFetchMock();
    const stream = createTelegramAlertStream({...baseOptions, dedupMs: 60_000, fetch});

    const record = {
      err: {message: 'qty must be > 0', stack: 'at AlpacaAPI.postOrder', type: 'SimplifiedHttpError'},
      level: 50,
      msg: 'Strategy error',
      strategyId: 8,
    };

    for (let i = 0; i < 5; i++) {
      await writeRecord(stream, record);
    }

    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledTimes(1); // sanity: still 1 after waitFor's poll window
  });

  it('lets through two errors that share fingerprint after the window elapses (smoke check via custom dedupMs=0)', async () => {
    const fetch = makeFetchMock();
    const stream = createTelegramAlertStream({...baseOptions, dedupMs: 0, fetch});

    await writeRecord(stream, {err: {message: 'm', type: 'X'}, level: 50, msg: 'a'});
    await writeRecord(stream, {err: {message: 'm', type: 'X'}, level: 50, msg: 'a'});

    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  });

  it('writes a stderr warning when the Bot API responds non-2xx, and does not throw', async () => {
    const fetch = makeFetchMock({ok: false, status: 401, statusText: 'Unauthorized'});
    const stderr: string[] = [];
    const stream = createTelegramAlertStream({...baseOptions, fetch, stderrWrite: chunk => stderr.push(chunk)});

    await writeRecord(stream, {level: 50, msg: 'X'});
    await vi.waitFor(() => expect(stderr.length).toBeGreaterThan(0));
    expect(stderr.join('')).toContain('401');
    expect(stderr.join('')).toContain('Unauthorized');
  });

  it('writes a stderr warning when fetch itself throws, and never propagates', async () => {
    const fetch = vi.fn().mockRejectedValue(new Error('ENOTFOUND')) as FetchMock;
    const stderr: string[] = [];
    const stream = createTelegramAlertStream({...baseOptions, fetch, stderrWrite: chunk => stderr.push(chunk)});

    await writeRecord(stream, {level: 50, msg: 'X'});
    await vi.waitFor(() => expect(stderr.length).toBeGreaterThan(0));
    expect(stderr.join('')).toContain('ENOTFOUND');
  });

  it('silently ignores garbage that is not valid JSON (pino guarantees JSON, but defensive)', async () => {
    const fetch = makeFetchMock();
    const stream = createTelegramAlertStream({...baseOptions, fetch});

    await new Promise<void>(resolve => stream.write('not json\n', 'utf8', () => resolve()));
    expect(fetch).not.toHaveBeenCalled();
  });
});
