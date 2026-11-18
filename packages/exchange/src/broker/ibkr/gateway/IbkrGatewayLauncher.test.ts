import type {ChildProcess} from 'node:child_process';
import {describe, expect, it, vi} from 'vitest';
import type {IbkrAPI} from '../api/IbkrAPI.js';
import {IbkrGatewayStage} from './IbkrGatewayState.js';

const mockMethods = {
  ensureGateway: vi.fn<() => Promise<void>>(),
  getAuthStatus: vi.fn<IbkrAPI['getAuthStatus']>(),
  isAuthenticated: vi.fn<(gatewayUrl: string) => Promise<boolean>>(),
  loginToIbkrGateway: vi.fn<() => Promise<void>>(),
  startGateway: vi.fn<() => Promise<ChildProcess>>(),
  stopGateway: vi.fn<(child: unknown) => void>(),
};

/*
 * Without this the launcher's own port probe makes a real request to a dead port and waits out
 * `@retry`, which costs seconds per test for an answer the test already decides.
 */
vi.mock(import('../api/IbkrAPI.js'), async importActual => ({
  ...(await importActual()),
  IbkrAPI: class {
    static readonly URL_GATEWAY = 'https://localhost:5001';
    getAuthStatus = mockMethods.getAuthStatus;
  } as unknown as typeof IbkrAPI,
}));

/*
 * Wrapped rather than passed by reference: `vi.mock` is hoisted above `mockMethods`, so naming a
 * property in the factory body reads it before initialization. An arrow defers that to call time.
 */
vi.mock(import('./loginToIbkrGateway.js'), () => ({
  isAuthenticated: (gatewayUrl: string) => mockMethods.isAuthenticated(gatewayUrl),
  loginToIbkrGateway: () => mockMethods.loginToIbkrGateway(),
}));

vi.mock(import('./startIbkrGateway.js'), () => ({
  ensureGateway: () => mockMethods.ensureGateway(),
  startGateway: () => mockMethods.startGateway(),
  stopGateway: (child: unknown) => mockMethods.stopGateway(child),
}));

const {IbkrGatewayLauncher} = await import('./IbkrGatewayLauncher.js');

const credentials = {account: 'U1', password: 'secret'};

// Not concurrent: the launcher is shared per gateway address, which a parallel run would interleave.
describe('IbkrGatewayLauncher', {concurrent: false}, () => {
  const launcherFor = (
    gatewayUrl: string,
    onStateChange?: (state: {stage: string}) => void
  ): ReturnType<typeof IbkrGatewayLauncher.for> => IbkrGatewayLauncher.for({...credentials, gatewayUrl, onStateChange});

  it('leaves an already-authenticated gateway alone', async () => {
    vi.clearAllMocks();
    mockMethods.isAuthenticated.mockResolvedValue(true);

    const launcher = launcherFor('https://localhost:6001');
    await launcher.ready;

    expect(
      mockMethods.loginToIbkrGateway,
      'logging in again would push to the phone for nothing, turning one tap a day into one per process start'
    ).not.toHaveBeenCalled();
    expect(launcher.state.stage).toBe(IbkrGatewayStage.AUTHENTICATED);
    launcher.stop();
  });

  it('reports that it is waiting on the second factor rather than appearing hung', async () => {
    vi.clearAllMocks();
    mockMethods.getAuthStatus.mockRejectedValue(new Error('nothing listening'));
    mockMethods.isAuthenticated.mockResolvedValue(false);
    mockMethods.loginToIbkrGateway.mockResolvedValue();
    const stages: string[] = [];

    const launcher = launcherFor('https://localhost:6002', state => stages.push(state.stage));
    await launcher.ready;

    expect(stages, 'a caller needs this to tell a phone tap from a stall').toContain(
      IbkrGatewayStage.AWAITING_TWO_FACTOR
    );
    launcher.stop();
  });

  it('shares one launcher per gateway address', () => {
    vi.clearAllMocks();
    const first = launcherFor('https://localhost:6003');
    const second = launcherFor('https://localhost:6003');

    expect(second, 'two launchers on one port would each download and start the gateway').toBe(first);
    first.stop();
  });

  it('does not stop a gateway it did not start', async () => {
    vi.clearAllMocks();
    mockMethods.isAuthenticated.mockResolvedValue(true);

    const launcher = launcherFor('https://localhost:6004');
    await launcher.ready;
    launcher.stop();

    expect(
      mockMethods.stopGateway,
      'a gateway that was already running serves the rest of the machine too'
    ).not.toHaveBeenCalled();
  });

  it('surfaces a login failure as the reason, not as a later 401', async () => {
    vi.clearAllMocks();
    mockMethods.getAuthStatus.mockRejectedValue(new Error('nothing listening'));
    mockMethods.isAuthenticated.mockResolvedValue(false);
    mockMethods.loginToIbkrGateway.mockRejectedValue(new Error('IBKR rejected the password'));

    const launcher = launcherFor('https://localhost:6005');

    await expect(launcher.ready).rejects.toThrow('IBKR rejected the password');
    expect(launcher.state.stage).toBe(IbkrGatewayStage.FAILED);
    launcher.stop();
  });
});
