import 'dotenv-defaults/config.js';

import {Agent} from '@xmtp/agent-sdk';
import {getTestUrl} from '@xmtp/agent-sdk/debug';
import {CommandRouter} from '@xmtp/agent-sdk/middleware';
import time from './command/time.js';
import candle from './command/candle.js';
import {isFromOwner} from './middleware/isFromOwner.js';

const router = new CommandRouter();

router.command('/candle', async ctx => {
  await ctx.conversation.send(await candle(ctx.message.content));
});

router.command('/time', async ctx => {
  await ctx.conversation.send(await time());
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
await agent.client.revokeAllOtherInstallations();
await agent.start();
