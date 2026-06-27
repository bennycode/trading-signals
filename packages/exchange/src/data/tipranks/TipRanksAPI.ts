import axios from 'axios';
import axiosRetry from 'axios-retry';
import {ms} from 'ms';
import {z} from 'zod';
import {TipRanksAssetSchema} from './schema/TipRanksAssetSchema.js';
import {TipRanksTechnicalSchema} from './schema/TipRanksTechnicalSchema.js';
import {simplifyError} from '../../util/simplifyError.js';

const EnvelopeSchema = z.looseObject({
  error: z.looseObject({message: z.string()}).optional(),
  result: z
    .looseObject({
      content: z.array(z.looseObject({text: z.string()})).optional(),
      isError: z.boolean().optional(),
      structuredContent: z.looseObject({result: z.string()}).optional(),
    })
    .optional(),
});

/**
 * Pulls the `data:` payload out of the MCP server's Server-Sent-Events response, unwraps the
 * JSON-RPC envelope, and parses the tool result (which TipRanks returns as a JSON *string*).
 */
function parseToolResult(sse: string): unknown {
  const payload = sse
    .split('\n')
    .filter(line => line.startsWith('data:'))
    .map(line => line.slice('data:'.length).trim())
    .join('');

  const envelope = EnvelopeSchema.parse(JSON.parse(payload));
  if (envelope.error) {
    throw new Error(`TipRanks MCP error: ${envelope.error.message}`);
  }
  if (!envelope.result || envelope.result.isError) {
    throw new Error('TipRanks MCP returned an error result.');
  }
  const json = envelope.result.structuredContent?.result ?? envelope.result.content?.[0]?.text;
  if (json === undefined) {
    throw new Error('TipRanks MCP returned no content.');
  }
  return JSON.parse(json);
}

/**
 * Read-only client for TipRanks' hosted MCP server. The server speaks MCP over a stateless HTTP
 * transport: a single `tools/call` POST returns the result, so no SDK or session handshake is
 * needed. The API key is sent as the `apikey` query parameter.
 *
 * @see https://mcp.tipranks.com
 */
export class TipRanksAPI {
  readonly #client;

  constructor(options: {apiKey: string}) {
    this.#client = axios.create({
      baseURL: 'https://mcp.tipranks.com',
      headers: {Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json'},
      params: {apikey: options.apiKey},
      responseType: 'text',
    });
    axiosRetry(this.#client, {
      retries: 3,
      retryDelay: retryCount => retryCount * ms('1s'),
    });
    simplifyError(this.#client);
  }

  async #callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const response = await this.#client.post<string>('/mcp', {
      id: 1,
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {arguments: args, name},
    });
    return parseToolResult(response.data);
  }

  /** Headline per-ticker data: price, Smart Score, analyst consensus, price target, trailing P/E. */
  async getAssetsData(tickers: string[]) {
    const data = await this.#callTool('get_assets_data', {tickers: tickers.join(',')});
    return z.looseObject({assetsData: z.array(TipRanksAssetSchema)}).parse(data).assetsData;
  }

  /** Technical analysis per ticker; used here for the simple 200-day moving average. */
  async getTechnicalAnalysis(tickers: string[]) {
    const data = await this.#callTool('get_technical_analysis', {tickers: tickers.join(',')});
    return z.array(TipRanksTechnicalSchema).parse(data);
  }
}
