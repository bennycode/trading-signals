import {Broker} from './Broker.js';
import {getBrokerClient} from './getBrokerClient.js';
import {MarketDataSource} from './MarketDataSource.js';

/**
 * Build a broker client and prove its credentials are authorized by issuing a network request.
 */
export async function getAuthenticatedBrokerClient(
  ...args: Parameters<typeof getBrokerClient>
): Promise<Broker & MarketDataSource> {
  const client = getBrokerClient(...args);
  await client.getTime();
  return client;
}
