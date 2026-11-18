import type {IbkrAPI} from './api/IbkrAPI.js';
import type {IbkrPosition} from './api/schema/AccountSchema.js';

/** IBKR's page size for `/portfolio/{id}/positions/{page}`. */
export const IBKR_POSITIONS_PER_PAGE = 30;

/** Enough pages for 3,000 holdings, past which a runaway loop is likelier than a real account. */
export const IBKR_MAX_POSITION_PAGES = 100;

/**
 * Every page of open positions.
 *
 * IBKR serves these 30 at a time. Stopping at the first page reports an account holding more than
 * 30 instruments as if the rest were flat, which a strategy reads as "no position" and acts on.
 *
 * @see https://www.interactivebrokers.com/docs/web-api/api-reference/trading/portfolio
 */
export async function getAllIbkrPositions(input: {accountId: string; api: IbkrAPI}): Promise<IbkrPosition[]> {
  const {accountId, api} = input;
  const positions: IbkrPosition[] = [];

  for (let pageId = 0; pageId < IBKR_MAX_POSITION_PAGES; pageId++) {
    const page = await api.getPositions(accountId, pageId);
    positions.push(...page);

    if (page.length < IBKR_POSITIONS_PER_PAGE) {
      break;
    }
  }

  return positions;
}
