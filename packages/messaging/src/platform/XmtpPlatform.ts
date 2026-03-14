import {Agent, validHex} from '@xmtp/agent-sdk';
import {CommandRouter} from '@xmtp/agent-sdk/middleware';
import type {CommandHandler, MessageContext, MessagingPlatform, PlatformInfo} from './MessagingPlatform.js';

const PLATFORM_PREFIX = 'xmtp:';

export class XmtpPlatform implements MessagingPlatform {
  #agent: Agent | null = null;
  #router = new CommandRouter();
  #ownerAddresses: string | undefined;
  #platformInfo: PlatformInfo = {botAddress: '', sdkVersion: ''};

  constructor(ownerAddresses?: string) {
    this.#ownerAddresses = ownerAddresses;
  }

  registerCommand(name: string | string[], handler: CommandHandler): void {
    const names = Array.isArray(name) ? name : [name];
    for (const n of names) {
      this.#router.command(`/${n}`, async ctx => {
      const senderAddress = await ctx.getSenderAddress();

      if (!senderAddress) {
        await ctx.conversation.sendMarkdown('Unable to determine sender address');
        return;
      }

      const messageCtx: MessageContext = {
        senderId: `${PLATFORM_PREFIX}${senderAddress}`,
        platformId: 'xmtp',
        content: ctx.message.content,
        reply: async (text: string) => {
          await ctx.conversation.sendMarkdown(text);
        },
      };

      await handler(messageCtx);
    });
    }
  }

  async start(): Promise<void> {
    this.#agent = await Agent.createFromEnv({
      appVersion: '@typedtrader/messaging',
    });

    if (this.#ownerAddresses) {
      const addresses = this.#ownerAddresses.split(',').map(a => a.trim());

      this.#agent.use(async (ctx, next) => {
        const senderAddress = await ctx.getSenderAddress();

        if (senderAddress && addresses.includes(senderAddress)) {
          await next();
        } else {
          console.warn(
            `Ignoring XMTP message from "${senderAddress}" - only messages from owners [${addresses.join(', ')}] are processed.`
          );
        }
      });
    } else {
      console.warn('Warning: XMTP_OWNER_ADDRESSES is not set. Everyone can message the bot via XMTP.');
    }

    this.#agent.use(this.#router.middleware());

    this.#agent.on('start', async ctx => {
      const clientAddress = ctx.getClientAddress();
      this.#platformInfo = {
        botAddress: clientAddress ?? 'unknown',
        sdkVersion: ctx.client.libxmtpVersion ?? 'unknown',
      };
    });

    await this.#agent.start();
  }

  async stop(): Promise<void> {
    if (this.#agent) {
      await this.#agent.stop();
    }
  }

  async sendMessage(userId: string, text: string): Promise<void> {
    if (!this.#agent) {
      throw new Error('XmtpPlatform not started');
    }

    const address = userId.replace(PLATFORM_PREFIX, '');
    const dm = await this.#agent.createDmWithAddress(validHex(address));
    await dm.sendMarkdown(text);
  }

  get commandList(): string[] {
    return this.#router.commandList;
  }

  get platformInfo(): PlatformInfo {
    return this.#platformInfo;
  }
}
