import {describe, it, expect, vi, beforeEach} from 'vitest';

const mocks = vi.hoisted(() => {
  const mockCommandList = ['/help', '/status'] as const;
  const mockRouterCommand = vi.fn();
  const mockRouterMiddleware = vi.fn().mockReturnValue(vi.fn());
  const mockAgentStop = vi.fn().mockResolvedValue(undefined);
  const mockAgentUse = vi.fn();
  const mockAgentOn = vi.fn();
  const mockAgentStart = vi.fn().mockResolvedValue(undefined);
  const mockCreateDmWithAddress = vi.fn();
  const mockSendMarkdown = vi.fn().mockResolvedValue(undefined);

  const mockAgentInstance = {
    use: mockAgentUse,
    on: mockAgentOn,
    start: mockAgentStart,
    stop: mockAgentStop,
    createDmWithAddress: mockCreateDmWithAddress,
  };

  function CommandRouter() {
    return {
      command: mockRouterCommand,
      middleware: mockRouterMiddleware,
      get commandList() {
        return mockCommandList;
      },
    };
  }

  return {
    mockCommandList,
    mockRouterCommand,
    mockRouterMiddleware,
    mockAgentStop,
    mockAgentUse,
    mockAgentOn,
    mockAgentStart,
    mockCreateDmWithAddress,
    mockSendMarkdown,
    mockAgentInstance,
    CommandRouter,
    Agent: {
      createFromEnv: vi.fn().mockResolvedValue(mockAgentInstance),
    },
    validHex: vi.fn((v: string) => v),
  };
});

// Both '@xmtp/agent-sdk' and '@xmtp/agent-sdk/middleware' resolve to the same
// underlying dist/index.js, so we mock both consistently.
vi.mock('@xmtp/agent-sdk', () => ({
  Agent: mocks.Agent,
  validHex: mocks.validHex,
}));

vi.mock('@xmtp/agent-sdk/middleware', () => ({
  Agent: mocks.Agent,
  CommandRouter: mocks.CommandRouter,
  validHex: mocks.validHex,
}));

import {XmtpPlatform} from './XmtpPlatform.js';

describe('XmtpPlatform', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockRouterMiddleware.mockReturnValue(vi.fn());
    mocks.mockCreateDmWithAddress.mockResolvedValue({sendMarkdown: mocks.mockSendMarkdown});
    mocks.mockAgentStart.mockResolvedValue(undefined);
    mocks.mockAgentStop.mockResolvedValue(undefined);
    mocks.Agent.createFromEnv.mockResolvedValue(mocks.mockAgentInstance);
  });

  describe('commandList', () => {
    it('delegates to the router commandList', () => {
      const platform = new XmtpPlatform();

      expect(platform.commandList).toEqual(mocks.mockCommandList);
    });
  });

  describe('sendMessage', () => {
    it('strips the xmtp: prefix before sending', async () => {
      const platform = new XmtpPlatform();

      await platform.start();

      await platform.sendMessage('xmtp:0xabc123', 'Hello!');

      expect(mocks.mockCreateDmWithAddress).toHaveBeenCalledWith('0xabc123');
      expect(mocks.mockSendMarkdown).toHaveBeenCalledWith('Hello!');
    });

    it('throws when platform is not started', async () => {
      const platform = new XmtpPlatform();

      await expect(platform.sendMessage('xmtp:0xabc123', 'Hello!')).rejects.toThrow('XmtpPlatform not started');
    });
  });
});
