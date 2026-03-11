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
  strategyAdd,
  strategyList,
  strategyRemove,
  time,
  uptime,
  watchAdd,
  watchList,
  watchRemove,
} from './command/index.js';
import {initializeDatabase} from './database/initializeDatabase.js';
import {StrategyMonitor} from './service/StrategyMonitor.js';
import {WatchMonitor} from './service/WatchMonitor.js';

export async function startServer() {
  await initializeDatabase();

  const agent = await Agent.createFromEnv({
    appVersion: '@typedtrader/messaging',
  });

  const strategyMonitor = new StrategyMonitor(agent);
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

  router.command('/watchAdd', async ctx => {
    const userAddress = await ctx.getSenderAddress();
    if (!userAddress) {
      await ctx.conversation.sendText('Unable to determine sender address');
      return;
    }
    const result = await watchAdd(ctx.message.content, userAddress);
    await ctx.conversation.sendText(result.message);
    // Subscribe to the new watch via WebSocket
    if (result.watch) {
      try {
        await watchMonitor.subscribeToWatch(result.watch);
      } catch (error) {
        console.error(`Error subscribing to new watch: ${error}`);
      }
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
    await ctx.conversation.sendText(result.message);
    // Unsubscribe from the watch WebSocket
    if (result.watchId) {
      watchMonitor.unsubscribeFromWatch(result.watchId);
    }
  });

  router.command('/strategyAdd', async ctx => {
    const userAddress = await ctx.getSenderAddress();
    if (!userAddress) {
      await ctx.conversation.sendText('Unable to determine sender address');
      return;
    }
    const result = await strategyAdd(ctx.message.content, userAddress);
    await ctx.conversation.sendText(result.message);
    if (result.strategy) {
      try {
        await strategyMonitor.subscribeToStrategy(result.strategy);
      } catch (error) {
        console.error(`Error starting strategy: ${error}`);
      }
    }
  });

  router.command('/strategyList', async ctx => {
    const userAddress = await ctx.getSenderAddress();
    if (!userAddress) {
      await ctx.conversation.sendText('Unable to determine sender address');
      return;
    }
    await ctx.conversation.sendText(await strategyList(userAddress));
  });

  router.command('/strategyRemove', async ctx => {
    const userAddress = await ctx.getSenderAddress();
    if (!userAddress) {
      await ctx.conversation.sendText('Unable to determine sender address');
      return;
    }
    const result = await strategyRemove(ctx.message.content, userAddress);
    await ctx.conversation.sendText(result.message);
    if (result.strategyId) {
      try {
        await strategyMonitor.unsubscribeFromStrategy(result.strategyId);
      } catch (error) {
        console.error(`Error stopping strategy: ${error}`);
      }
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

  agent.on('start', async ctx => {
    console.log(`Message me: ${getTestUrl(ctx.client)}`);
    // Start WebSocket subscriptions for all existing watches and strategies
    try {
      await watchMonitor.start();
    } catch (error) {
      console.error('Error starting watch monitor:', error);
    }
    try {
      await strategyMonitor.start();
    } catch (error) {
      console.error('Error starting strategy monitor:', error);
    }
  });

  // Handle graceful shutdown
  const shutdown = async () => {
    try {
      watchMonitor.stop();
      await strategyMonitor.stop();
    } catch (error) {
      console.error('Error during shutdown:', error);
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  if (process.env.XMTP_OWNER_ADDRESSES) {
    console.log(`Only admin wallet addresses (${process.env.XMTP_OWNER_ADDRESSES}) can message the bot.`);
    agent.use(isFromOwner(process.env.XMTP_OWNER_ADDRESSES));
  } else {
    console.warn(
      'Warning: XMTP_OWNER_ADDRESSES is not set. Everyone can message the bot, which may not be intentional.'
    );
  }
  agent.use(router.middleware());
  await agent.start();
}
