import {Agent, ActionWizard, validHex} from '@xmtp/agent-sdk';
import {CommandRouter} from '@xmtp/agent-sdk/middleware';
import {getAvailableReportNames} from 'trading-strategies';
import type {CommandHandler, MessageContext, MessagingPlatform, PlatformInfo} from './MessagingPlatform.js';
import {reportAdd} from '../command/report/reportAdd.js';
import type {ReportScheduler} from '../service/ReportScheduler.js';

const PLATFORM_PREFIX = 'xmtp:';

export class XmtpPlatform implements MessagingPlatform {
  #agent: Agent | null = null;
  #router = new CommandRouter();
  #ownerAddresses: string | undefined;
  #platformInfo: PlatformInfo = {botAddress: '', sdkVersion: ''};
  #reportScheduler?: ReportScheduler;

  constructor(ownerAddresses?: string) {
    this.#ownerAddresses = ownerAddresses;
  }

  setReportScheduler(scheduler: ReportScheduler): void {
    this.#reportScheduler = scheduler;
  }

  registerCommand(name: string | string[], handler: CommandHandler): void {
    const names = Array.isArray(name) ? name : [name];

    // Skip reportadd registration — handled by ActionWizard
    if (names.includes('reportadd')) {
      return;
    }

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

  #createReportWizard(): ActionWizard | null {
    const available = getAvailableReportNames();
    if (available.length === 0) {
      return null;
    }

    const wizard = new ActionWizard('reportadd', {cancel: true});

    wizard.select('reportName', {
      description: 'Select a report to run:',
      actions: available.map(name => ({id: name, label: name})),
    });

    wizard.onComplete(async (answers, ctx) => {
      const senderAddress = await ctx.getSenderAddress();
      if (!senderAddress) {
        await ctx.conversation.sendMarkdown('Unable to determine sender address');
        return;
      }

      const senderId = `${PLATFORM_PREFIX}${senderAddress}`;
      const result = await reportAdd(answers.reportName, senderId);

      await ctx.conversation.sendMarkdown(result.message);

      if (result.report?.intervalMs && this.#reportScheduler) {
        this.#reportScheduler.scheduleReport(result.report);
      }
    });

    wizard.onCancel(async ctx => {
      await ctx.conversation.sendMarkdown('Report setup cancelled.');
    });

    return wizard;
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

    const reportWizard = this.#createReportWizard();
    if (reportWizard) {
      this.#agent.use(reportWizard.middleware());
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
    return [...this.#router.commandList, '/reportadd'];
  }

  get platformInfo(): PlatformInfo {
    return this.#platformInfo;
  }
}
