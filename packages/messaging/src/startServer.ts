import {Agent, AgentMessageHandler} from '@xmtp/agent-sdk';
import {getTestUrl} from '@xmtp/agent-sdk/debug';
import {CommandRouter} from '@xmtp/agent-sdk/middleware';
import {isFromOwner} from './middleware/isFromOwner.js';
import {accountAdd, accountList, accountRemove, accountTime, candle, time, uptime} from './command/index.js';
import {initializeDatabase} from './database/initializeDatabase.js';

export async function startServer() {
  await initializeDatabase();

  const router = new CommandRouter();

  const help: AgentMessageHandler<string> = async ctx => {
    const commandCodeBlocks = router.commandList.map(cmd => `\`${cmd}\``);
    const answer = `I am supporting the following commands: ${commandCodeBlocks.join(', ')}`;
    await ctx.conversation.sendMarkdown(answer);
  };

  router.command('/accountAdd', async ctx => {
    const result = await accountAdd(ctx.message.content);
    if (result) {
      await ctx.conversation.sendText(result);
    }
  });

  router.command('/accountList', async ctx => {
    await ctx.conversation.sendText(await accountList());
  });

  router.command('/accountRemove', async ctx => {
    const result = await accountRemove(ctx.message.content);
    if (result) {
      await ctx.conversation.sendText(result);
    }
  });

  router.command('/accountTime', async ctx => {
    const result = await accountTime(ctx.message.content);
    if (result) {
      await ctx.conversation.sendText(result);
    }
  });

  router.command('/candle', async ctx => {
    const candleJson = await candle(ctx.message.content);
    if (candleJson) {
      await ctx.conversation.sendText(candleJson);
    }
  });

  router.command('/help', help);

  router.command('/time', async ctx => {
    await ctx.conversation.sendText(await time());
  });

  router.command('/uptime', async ctx => {
    await ctx.conversation.sendText(await uptime());
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

  const agent = await Agent.createFromEnv({
    appVersion: '@typedtrader/messaging',
  });

  agent.on('start', ctx => {
    console.log(`Message me: ${getTestUrl(ctx.client)}`);
  });

  if (process.env.XMTP_OWNER_ADDRESS) {
    agent.use(isFromOwner);
  }
  agent.use(router.middleware());
  await agent.start();
}
