import {Agent, AgentMessageHandler} from '@xmtp/agent-sdk';
import {getTestUrl} from '@xmtp/agent-sdk/debug';
import {CommandRouter} from '@xmtp/agent-sdk/middleware';
import {isFromOwner} from './middleware/isFromOwner.js';
import {
  accountAdd,
  accountList,
  accountRemove,
  accountTime,
  candle,
  price,
  time,
  uptime,
  watch,
  watchList,
  watchRemove,
} from './command/index.js';
import {initializeDatabase} from './database/initializeDatabase.js';
import {WatchMonitor} from './service/WatchMonitor.js';

export async function startServer() {
  await initializeDatabase();

  const agent = await Agent.createFromEnv({
    appVersion: '@typedtrader/messaging',
  });

  // Initialize the watch monitor
  const watchMonitor = new WatchMonitor(agent);

  const router = new CommandRouter();

  const help: AgentMessageHandler<string> = async ctx => {
    const commandCodeBlocks = router.commandList.map(cmd => `\`${cmd}\``);
    const answer = `I am supporting the following commands: ${commandCodeBlocks.join(', ')}`;
    await ctx.conversation.sendMarkdown(answer);
  };

  router.command('/accountAdd', async ctx => {
    const ownerAddress = await ctx.getSenderAddress();
    if (!ownerAddress) {
      await ctx.conversation.sendText('Unable to determine sender address');
      return;
    }
    const result = await accountAdd(ctx.message.content, ownerAddress);
    if (result) {
      await ctx.conversation.sendText(result);
    }
  });

  router.command('/accountList', async ctx => {
    const ownerAddress = await ctx.getSenderAddress();
    if (!ownerAddress) {
      await ctx.conversation.sendText('Unable to determine sender address');
      return;
    }
    await ctx.conversation.sendText(await accountList(ownerAddress));
  });

  router.command('/accountRemove', async ctx => {
    const ownerAddress = await ctx.getSenderAddress();
    if (!ownerAddress) {
      await ctx.conversation.sendText('Unable to determine sender address');
      return;
    }
    const result = await accountRemove(ctx.message.content, ownerAddress);
    if (result) {
      await ctx.conversation.sendText(result);
    }
  });

  router.command('/accountTime', async ctx => {
    const ownerAddress = await ctx.getSenderAddress();
    if (!ownerAddress) {
      await ctx.conversation.sendText('Unable to determine sender address');
      return;
    }
    const result = await accountTime(ctx.message.content, ownerAddress);
    if (result) {
      await ctx.conversation.sendText(result);
    }
  });

  router.command('/candle', async ctx => {
    const ownerAddress = await ctx.getSenderAddress();
    if (!ownerAddress) {
      await ctx.conversation.sendText('Unable to determine sender address');
      return;
    }
    const candleJson = await candle(ctx.message.content, ownerAddress);
    if (candleJson) {
      await ctx.conversation.sendText(candleJson);
    }
  });

  router.command('/help', help);

  router.command('/price', async ctx => {
    const ownerAddress = await ctx.getSenderAddress();
    if (!ownerAddress) {
      await ctx.conversation.sendText('Unable to determine sender address');
      return;
    }
    await ctx.conversation.sendText(await price(ctx.message.content, ownerAddress));
  });

  router.command('/time', async ctx => {
    await ctx.conversation.sendText(await time());
  });

  router.command('/uptime', async ctx => {
    await ctx.conversation.sendText(await uptime());
  });

  router.command('/watch', async ctx => {
    const userAddress = await ctx.getSenderAddress();
    if (!userAddress) {
      await ctx.conversation.sendText('Unable to determine sender address');
      return;
    }
    const result = await watch(ctx.message.content, userAddress);
    if (result) {
      await ctx.conversation.sendText(result);
      // Check watches immediately after adding a new one
      watchMonitor.checkWatches().catch(error => {
        console.error('Error checking watches after adding new watch:', error);
      });
    }
  });

  router.command('/watchList', async ctx => {
    const userAddress = await ctx.getSenderAddress();
    if (!userAddress) {
      await ctx.conversation.sendText('Unable to determine sender address');
      return;
    }
    await ctx.conversation.sendText(await watchList(userAddress));
  });

  router.command('/watchRemove', async ctx => {
    const userAddress = await ctx.getSenderAddress();
    if (!userAddress) {
      await ctx.conversation.sendText('Unable to determine sender address');
      return;
    }
    const result = await watchRemove(ctx.message.content, userAddress);
    if (result) {
      await ctx.conversation.sendText(result);
    }
  });

  router.command('/myaddress', async ctx => {
    const yourAddress = await ctx.getSenderAddress();
    await ctx.conversation.sendText(`Your address is: ${yourAddress}`);
  });

  router.command('/youraddress', async ctx => {
    const myAddress = await ctx.getClientAddress();
    await ctx.conversation.sendText(`My address is: ${myAddress}`);
  });

  router.command('/version', async ctx => {
    const libXmtpVersion = ctx.client.libxmtpVersion;
    await ctx.conversation.sendText(`My libXMTP version is: ${libXmtpVersion}`);
  });

  agent.on('start', ctx => {
    console.log(`Message me: ${getTestUrl(ctx.client)}`);
    watchMonitor.checkWatches().catch(error => {
      console.error('Error checking watches on startup:', error);
    });
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    process.exit(0);
  });

  if (process.env.XMTP_OWNER_ADDRESS) {
    agent.use(isFromOwner);
  }
  agent.use(router.middleware());
  await agent.start();
}
