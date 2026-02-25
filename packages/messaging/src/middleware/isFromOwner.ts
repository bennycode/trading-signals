import {AgentMiddleware} from '@xmtp/agent-sdk';

export const isFromOwner: (ownerAddresses: string) => AgentMiddleware = ownerAddresses => {
  const addresses = ownerAddresses.split(',').map(a => a.trim());
  return async (ctx, next) => {
    const senderAddress = await ctx.getSenderAddress();

    if (senderAddress && addresses.includes(senderAddress)) {
      // Continue message processing
      await next();
    } else {
      // Block message processing
      console.warn(
        `Ignoring message from "${senderAddress}" - only messages from owners [${addresses.join(', ')}] are processed.`
      );
      return;
    }
  };
};
