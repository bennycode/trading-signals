import {beforeEach, describe, expect, it, vi} from 'vitest';

const {getBrokerClientMock, verifyCredentialsMock} = vi.hoisted(() => {
  const verifyCredentials = vi.fn();
  return {
    getBrokerClientMock: vi.fn(() => ({verifyCredentials})),
    verifyCredentialsMock: verifyCredentials,
  };
});

vi.mock('./getBrokerClient.js', () => ({
  getBrokerClient: getBrokerClientMock,
}));

const {getAuthenticatedBrokerClient} = await import('./getAuthenticatedBrokerClient.js');
const {SimplifiedHttpError} = await import('../util/SimplifiedHttpError.js');

const account = {
  apiKey: 'key',
  apiSecret: 'secret',
  exchangeId: 'Alpaca',
  isPaper: true,
};

describe('getAuthenticatedBrokerClient', {concurrent: false}, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the client once its credentials are verified', async () => {
    verifyCredentialsMock.mockResolvedValue(undefined);

    const client = await getAuthenticatedBrokerClient(account);

    expect(getBrokerClientMock).toHaveBeenCalledWith(account);
    expect(verifyCredentialsMock).toHaveBeenCalledTimes(1);
    expect(client).toBe(getBrokerClientMock.mock.results[0]?.value);
  });

  it('propagates the failure when credential verification is rejected', async () => {
    verifyCredentialsMock.mockRejectedValue(
      new SimplifiedHttpError({
        data: 'Unauthorized',
        status: 401,
        statusText: 'Unauthorized',
        url: '/api/v0/equity/account/cash',
      })
    );

    const failure = getAuthenticatedBrokerClient(account);

    await expect(failure).rejects.toBeInstanceOf(SimplifiedHttpError);
    await expect(failure).rejects.toMatchObject({status: 401});
  });
});
