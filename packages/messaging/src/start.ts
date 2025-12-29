import 'dotenv-defaults/config.js';

import {Agent} from '@xmtp/agent-sdk';
import {getTestUrl} from '@xmtp/agent-sdk/debug';
import {CommandRouter} from '@xmtp/agent-sdk/middleware';
import time from './command/time.js';

const router = new CommandRouter();

router.command('/time', async ctx => {
  await ctx.conversation.send(await time());
});

const agent = await Agent.createFromEnv();

agent.on('start', ctx => {
  console.log(`Message me: ${getTestUrl(ctx.client)}`);
});

agent.use(router.middleware());
await agent.client.revokeAllOtherInstallations();
await agent.start();
