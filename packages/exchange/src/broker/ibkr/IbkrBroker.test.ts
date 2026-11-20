import Big from 'big.js';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {OrderSide, OrderType, type Candle, type Fill} from '../Broker.js';
import {MarketDataSource} from '../MarketDataSource.js';
import {TradingPair} from '../TradingPair.js';
import type * as ActualIbkrAPIModuleNamespace from './api/IbkrAPI.js';
import type {IbkrAPI} from './api/IbkrAPI.js';

type ActualIbkrAPIModule = typeof ActualIbkrAPIModuleNamespace;

const mockMethods = {
  cancelOrder: vi.fn<IbkrAPI['cancelOrder']>(),
  getAccounts: vi.fn<IbkrAPI['getAccounts']>(),
  getAuthStatus: vi.fn<IbkrAPI['getAuthStatus']>(),
  getContractInfoAndRules: vi.fn<IbkrAPI['getContractInfoAndRules']>(),
  getLedger: vi.fn<IbkrAPI['getLedger']>(),
  getLiveOrders: vi.fn<IbkrAPI['getLiveOrders']>(),
  getPortfolioAccounts: vi.fn<IbkrAPI['getPortfolioAccounts']>(),
  getPositions: vi.fn<IbkrAPI['getPositions']>(),
  getTrades: vi.fn<IbkrAPI['getTrades']>(),
  initSession: vi.fn<IbkrAPI['initSession']>(),
  previewOrder: vi.fn<IbkrAPI['previewOrder']>(),
  replyToOrderMessage: vi.fn<IbkrAPI['replyToOrderMessage']>(),
  searchContracts: vi.fn<IbkrAPI['searchContracts']>(),
  selectAccount: vi.fn<IbkrAPI['selectAccount']>(),
  submitOrder: vi.fn<IbkrAPI['submitOrder']>(),
};

vi.mock(import('./api/IbkrAPI.js'), () => ({
  IbkrAPI: class {
    cancelOrder = mockMethods.cancelOrder;
    defaults = {baseURL: 'https://localhost:5001'};
    getAccounts = mockMethods.getAccounts;
    getAuthStatus = mockMethods.getAuthStatus;
    getContractInfoAndRules = mockMethods.getContractInfoAndRules;
    getLedger = mockMethods.getLedger;
    getLiveOrders = mockMethods.getLiveOrders;
    selectAccount = mockMethods.selectAccount;
    getPortfolioAccounts = mockMethods.getPortfolioAccounts;
    getPositions = mockMethods.getPositions;
    getTrades = mockMethods.getTrades;
    initSession = mockMethods.initSession;
    previewOrder = mockMethods.previewOrder;
    replyToOrderMessage = mockMethods.replyToOrderMessage;
    searchContracts = mockMethods.searchContracts;
    submitOrder = mockMethods.submitOrder;
  } as unknown as typeof IbkrAPI,
}));

const {IbkrBroker} = await import('./IbkrBroker.js');
const {ibkrCommissionFor, parseIbkrCommission} = await import('./IbkrFees.js');

class MarketDataSourceStub extends MarketDataSource {
  latestClose = '200';

  async getCandles(): Promise<Candle[]> {
    return [this.#candle()];
  }

  protected override async getNewestCandles(): Promise<Candle[]> {
    return [this.#candle()];
  }

  #candle(): Candle {
    return {
      base: 'AAPL',
      close: this.latestClose,
      counter: 'USD',
      high: this.latestClose,
      low: this.latestClose,
      open: this.latestClose,
      openTimeInISO: new Date(0).toISOString(),
      openTimeInMillis: 0,
      sizeInMillis: 60_000,
      volume: '1',
    };
  }

  watchCandles() {
    return Promise.reject<string>(new Error('Not implemented'));
  }

  unwatchCandles(): void {}

  disconnect(): void {}
}

const pair = new TradingPair('AAPL', 'USD');

describe('IbkrBroker', {concurrent: false}, () => {
  let broker: InstanceType<typeof IbkrBroker>;
  let marketData: MarketDataSourceStub;

  beforeEach(() => {
    vi.clearAllMocks();
    marketData = new MarketDataSourceStub();
    broker = new IbkrBroker({accountId: 'U1', marketData});
    mockMethods.searchContracts.mockResolvedValue([{conid: '265598', sections: [{secType: 'STK'}], symbol: 'AAPL'}]);
    // The resolver confirms the contract quotes in the pair's counter currency before accepting it.
    mockMethods.getContractInfoAndRules.mockResolvedValue({currency: 'USD'});
    // The session is already on U1, so no account switch is needed; see `#resolveAccountId`.
    mockMethods.getAccounts.mockResolvedValue({accounts: ['U1'], selectedAccount: 'U1'});
    mockMethods.getLiveOrders.mockResolvedValue({orders: [], snapshot: true});
  });

  describe('verifyCredentials', () => {
    it('explains how to fix an unauthenticated gateway instead of failing obscurely later', async () => {
      mockMethods.getAuthStatus.mockResolvedValue({authenticated: false});
      mockMethods.initSession.mockResolvedValue({authenticated: false});

      await expect(broker.verifyCredentials()).rejects.toThrow(/no authenticated session/);
    });

    it('opens a brokerage session when the gateway is logged in but the session lapsed', async () => {
      mockMethods.getAuthStatus.mockResolvedValue({authenticated: false});
      mockMethods.initSession.mockResolvedValue({authenticated: true});

      await broker.verifyCredentials();

      expect(mockMethods.initSession, 'a lapsed session is recoverable without a human').toHaveBeenCalled();
    });
  });

  describe('getConid', () => {
    it('prefers the exact symbol match over a partial one', async () => {
      mockMethods.searchContracts.mockResolvedValue([
        {conid: '111', sections: [{secType: 'STK'}], symbol: 'AAPLX'},
        {conid: '265598', sections: [{secType: 'STK'}], symbol: 'AAPL'},
      ]);

      await expect(broker.getConid(pair), 'a substring match is a different instrument').resolves.toBe(265598);
    });

    it('prefers a listing that can actually be traded as a stock', async () => {
      mockMethods.searchContracts.mockResolvedValue([
        {conid: '111', sections: [{secType: 'OPT'}], symbol: 'AAPL'},
        {conid: '265598', sections: [{secType: 'STK'}], symbol: 'AAPL'},
      ]);

      await expect(broker.getConid(pair)).resolves.toBe(265598);
    });

    it('rejects an unresolvable currency instead of guessing', async () => {
      mockMethods.searchContracts.mockResolvedValue([{conid: '111', sections: [{secType: 'STK'}], symbol: 'AAPL'}]);
      mockMethods.getContractInfoAndRules.mockResolvedValue({currency: 'GBP'});

      await expect(broker.getConid(pair)).rejects.toThrow(/none quoting in USD/);
    });

    it('looks a symbol up once and reuses the result', async () => {
      await broker.getConid(pair);
      await broker.getConid(pair);

      expect(mockMethods.searchContracts, 'contract ids never change').toHaveBeenCalledTimes(1);
    });

    it('does not cache a failed lookup', async () => {
      mockMethods.searchContracts.mockRejectedValueOnce(new Error('gateway down'));

      await expect(broker.getConid(pair)).rejects.toThrow('gateway down');
      await expect(broker.getConid(pair), 'a transient error must not poison the symbol').resolves.toBe(265598);
    });

    it('fails loudly when IBKR knows no such symbol', async () => {
      mockMethods.searchContracts.mockResolvedValue([]);

      await expect(broker.getConid(new TradingPair('NOPE', 'USD'))).rejects.toThrow(/no stock with the exact symbol/);
    });

    it('refuses a partial match rather than ordering a different instrument', async () => {
      mockMethods.searchContracts.mockResolvedValue([{conid: '111', sections: [{secType: 'STK'}], symbol: 'AAPLX'}]);

      await expect(
        broker.getConid(pair),
        'placing an order for a symbol the caller never named is worse than failing'
      ).rejects.toThrow(/no stock with the exact symbol/);
    });

    it('refuses a listing with no tradable stock section', async () => {
      mockMethods.searchContracts.mockResolvedValue([{conid: '111', sections: [{secType: 'OPT'}], symbol: 'AAPL'}]);

      await expect(broker.getConid(pair)).rejects.toThrow(/no stock with the exact symbol/);
    });

    it('picks the listing quoting in the pair’s counter currency', async () => {
      mockMethods.searchContracts.mockResolvedValue([
        {conid: '111', sections: [{secType: 'STK'}], symbol: 'AAPL'},
        {conid: '265598', sections: [{secType: 'STK'}], symbol: 'AAPL'},
      ]);
      mockMethods.getContractInfoAndRules.mockResolvedValueOnce({currency: 'GBP'});
      mockMethods.getContractInfoAndRules.mockResolvedValueOnce({currency: 'USD'});

      await expect(
        broker.getConid(pair),
        'two listings can share a ticker and quote in different currencies, and only one is AAPL/USD'
      ).resolves.toBe(265598);
    });

    it('caches by the whole pair, not by its base', async () => {
      mockMethods.getContractInfoAndRules.mockResolvedValue({currency: 'USD'});
      await broker.getConid(pair);

      mockMethods.searchContracts.mockResolvedValue([{conid: '999', sections: [{secType: 'STK'}], symbol: 'AAPL'}]);
      mockMethods.getContractInfoAndRules.mockResolvedValue({currency: 'GBP'});

      await expect(
        broker.getConid(new TradingPair('AAPL', 'GBP')),
        'a base-only cache key would hand AAPL/GBP the contract AAPL/USD resolved to'
      ).resolves.toBe(999);
    });
  });

  describe('placeOrder', () => {
    it('answers a confirmation prompt and returns the order it unlocks', async () => {
      mockMethods.submitOrder.mockResolvedValue([{id: 'reply-1', message: ['Market order outside hours?']}]);
      mockMethods.replyToOrderMessage.mockResolvedValue([{order_id: '999', order_status: 'Submitted'}]);

      const order = await broker.placeMarketOrder(pair, {side: OrderSide.BUY, size: '3', sizeInCounter: false});

      expect(mockMethods.replyToOrderMessage, 'a prompt is a normal step, not a rejection').toHaveBeenCalledWith(
        'reply-1',
        true
      );
      expect(order.id).toBe('999');
      expect(order.type).toBe(OrderType.MARKET);
    });

    it('answers a chain of prompts until the order is accepted', async () => {
      mockMethods.submitOrder.mockResolvedValue([{id: 'reply-1', message: ['first']}]);
      mockMethods.replyToOrderMessage
        .mockResolvedValueOnce([{id: 'reply-2', message: ['second']}])
        .mockResolvedValueOnce([{order_id: '999'}]);

      const order = await broker.placeMarketOrder(pair, {side: OrderSide.BUY, size: '3', sizeInCounter: false});

      expect(mockMethods.replyToOrderMessage, 'each answer can raise a further prompt').toHaveBeenCalledTimes(2);
      expect(order.id).toBe('999');
    });

    it('marks a limit order for the extended sessions but not a market order', async () => {
      mockMethods.submitOrder.mockResolvedValue([{order_id: '999'}]);

      await broker.placeLimitOrder(pair, {price: '190', side: OrderSide.BUY, size: '1'});
      const limitTicket = mockMethods.submitOrder.mock.calls[0]?.[1];

      await broker.placeMarketOrder(pair, {side: OrderSide.BUY, size: '1', sizeInCounter: false});
      const marketTicket = mockMethods.submitOrder.mock.calls[1]?.[1];

      expect(limitTicket?.outsideRTH, 'pre-market and after-hours execution needs this flag').toBe(true);
      expect(
        limitTicket?.tif,
        'IBKR forces DAY on nothing — it takes GTC for every order type and with outsideRTH — so an order is not thrown away at the close'
      ).toBe('GTC');
      expect(
        marketTicket?.outsideRTH,
        'IBKR allows only limit-family types outside regular hours, so flagging a market order would have it refused'
      ).toBeUndefined();
    });

    it('honours an explicit DAY for a strategy that re-places each candle', async () => {
      const dayBroker = new IbkrBroker({accountId: 'U1', marketData, timeInForce: 'DAY'});
      mockMethods.submitOrder.mockResolvedValue([{order_id: '999'}]);

      await dayBroker.placeLimitOrder(pair, {price: '190', side: OrderSide.BUY, size: '1'});

      expect(mockMethods.submitOrder.mock.calls[0]?.[1]?.tif).toBe('DAY');
      dayBroker.disconnect();
    });

    it('routes to IBKR Overnight when asked, keeping the order alive into the next session', async () => {
      const overnightBroker = new IbkrBroker({accountId: 'U1', marketData, overnight: true});
      mockMethods.submitOrder.mockResolvedValue([{order_id: '999'}]);

      await overnightBroker.placeLimitOrder(pair, {price: '190', side: OrderSide.BUY, size: '1'});
      const ticket = mockMethods.submitOrder.mock.calls[0]?.[1];

      expect(
        ticket?.tif,
        'OVT would cancel an unfilled order at 03:50 ET, dropping it before the session it was meant to span'
      ).toBe('OND');
      expect(
        ticket?.outsideRTH,
        'the overnight venue is not the extended-hours book, and sending both flags had IBKR cancel the order unfilled once the session opened'
      ).toBeUndefined();
      overnightBroker.disconnect();
    });

    it('refuses a market order when routing overnight', async () => {
      const overnightBroker = new IbkrBroker({accountId: 'U1', marketData, overnight: true});

      await expect(
        overnightBroker.placeMarketOrder(pair, {side: OrderSide.BUY, size: '1', sizeInCounter: false}),
        'IBKR answers this combination with "The order type Market is invalid for this combination of exchange and security type", so it is caught before it reaches the venue'
      ).rejects.toThrow(/accepts limit orders only/);
      expect(mockMethods.submitOrder).not.toHaveBeenCalled();
      overnightBroker.disconnect();
    });

    it('gives up rather than looping forever on an endless prompt', async () => {
      mockMethods.submitOrder.mockResolvedValue([{id: 'reply-1', message: ['again']}]);
      mockMethods.replyToOrderMessage.mockResolvedValue([{id: 'reply-1', message: ['again']}]);

      await expect(
        broker.placeMarketOrder(pair, {side: OrderSide.BUY, size: '3', sizeInCounter: false})
      ).rejects.toThrow(/kept asking for confirmation/);
    });

    it('surfaces a rejection as an error carrying IBKR’s reason', async () => {
      mockMethods.submitOrder.mockResolvedValue([{error: 'Order size exceeds limit'}]);

      await expect(
        broker.placeMarketOrder(pair, {side: OrderSide.BUY, size: '3', sizeInCounter: false})
      ).rejects.toThrow(/Order size exceeds limit/);
    });

    it('reads the answer to its last allowed reply instead of reporting a live order as failed', async () => {
      mockMethods.submitOrder.mockResolvedValue([{id: 'reply-1', message: ['again']}]);
      mockMethods.replyToOrderMessage
        .mockResolvedValueOnce([{id: 'reply-1', message: ['again']}])
        .mockResolvedValueOnce([{id: 'reply-1', message: ['again']}])
        .mockResolvedValueOnce([{id: 'reply-1', message: ['again']}])
        .mockResolvedValueOnce([{id: 'reply-1', message: ['again']}])
        .mockResolvedValueOnce([{order_id: '999', order_status: 'Submitted'}]);

      const order = await broker.placeMarketOrder(pair, {side: OrderSide.BUY, size: '3', sizeInCounter: false});

      expect(
        order.id,
        'IBKR accepted the order on the fifth reply; throwing there leaves it live while the caller places it again'
      ).toBe('999');
      expect(mockMethods.replyToOrderMessage).toHaveBeenCalledTimes(5);
    });

    it('names the client order id when IBKR does not say whether the order landed', async () => {
      mockMethods.submitOrder.mockRejectedValue(new Error('socket hang up'));

      await expect(
        broker.placeMarketOrder(pair, {side: OrderSide.BUY, size: '3', sizeInCounter: false}),
        'without the cOID there is no handle on an order IBKR may have created, so a retry risks a double fill'
      ).rejects.toThrow(/Look it up by client order id [0-9a-f]{32}/);
    });

    it('surfaces a rejection that arrives behind another entry', async () => {
      mockMethods.submitOrder.mockResolvedValue([
        {id: 'reply-1', message: ['Market order outside hours?']},
        {error: 'Order size exceeds limit'},
      ]);

      await expect(
        broker.placeMarketOrder(pair, {side: OrderSide.BUY, size: '3', sizeInCounter: false})
      ).rejects.toThrow(/Order size exceeds limit/);
      expect(
        mockMethods.replyToOrderMessage,
        'a refused order has nothing left to confirm, so its sibling prompt must not be answered'
      ).not.toHaveBeenCalled();
    });

    it('answers a prompt that arrives behind an accepted order', async () => {
      mockMethods.submitOrder.mockResolvedValue([
        {order_id: '999', order_status: 'Submitted'},
        {id: 'reply-1', message: ['Confirm the size?']},
      ]);
      mockMethods.replyToOrderMessage.mockResolvedValue([{order_id: '999', order_status: 'Submitted'}]);

      await broker.placeMarketOrder(pair, {side: OrderSide.BUY, size: '3', sizeInCounter: false});

      expect(
        mockMethods.replyToOrderMessage,
        'the order does not exist until every prompt is answered, so an unanswered one cannot be read as acceptance'
      ).toHaveBeenCalledWith('reply-1', true);
    });

    it('sends a notional market order as cashQty rather than a share count', async () => {
      mockMethods.submitOrder.mockResolvedValue([{order_id: '999'}]);

      await broker.placeMarketOrder(pair, {side: OrderSide.BUY, size: '250', sizeInCounter: true});

      const [, request] = mockMethods.submitOrder.mock.calls[0] ?? [];
      expect(request?.cashQty, '`sizeInCounter` means a currency amount').toBe(250);
      expect(request?.quantity).toBeUndefined();
    });

    it('sends a quantity order as a share count', async () => {
      mockMethods.submitOrder.mockResolvedValue([{order_id: '999'}]);

      await broker.placeMarketOrder(pair, {side: OrderSide.BUY, size: '7', sizeInCounter: false});

      const [, request] = mockMethods.submitOrder.mock.calls[0] ?? [];
      expect(request?.quantity).toBe(7);
      expect(request?.cashQty).toBeUndefined();
    });

    it('attaches a client order id so a failed submission can be reconciled', async () => {
      mockMethods.submitOrder.mockResolvedValue([{order_id: '999'}]);

      await broker.placeLimitOrder(pair, {price: '180', side: OrderSide.BUY, size: '1'});

      const [, request] = mockMethods.submitOrder.mock.calls[0] ?? [];
      expect(request?.cOID, 'without it, a timed-out POST cannot be told from a lost order').toBeTruthy();
      expect(request?.price).toBe(180);
    });
  });

  describe('getOpenOrders', () => {
    it('returns only working orders for the requested instrument', async () => {
      mockMethods.getLiveOrders.mockResolvedValue({
        orders: [
          {
            conid: '265598',
            orderId: 1,
            orderType: 'LMT',
            price: '180',
            side: 'BUY',
            status: 'Submitted',
            totalSize: '5',
          },
          {conid: '265598', orderId: 2, orderType: 'LMT', price: '181', side: 'BUY', status: 'Filled', totalSize: '5'},
          {
            conid: '999999',
            orderId: 3,
            orderType: 'LMT',
            price: '10',
            side: 'BUY',
            status: 'Submitted',
            totalSize: '5',
          },
        ],
      });

      const orders = await broker.getOpenOrders(pair);

      expect(
        orders.map(order => order.id),
        'filled orders and other instruments are not open orders'
      ).toEqual(['1']);
    });
  });

  describe('getFillByOrderId', () => {
    it('merges partial executions into one fill with a weighted average price', async () => {
      mockMethods.getPortfolioAccounts.mockResolvedValue([{currency: 'EUR', id: 'U1'}]);
      mockMethods.getTrades.mockResolvedValue([
        {commission: '0.35', conid: '265598', order_id: 55, price: '100', side: 'B', size: 1, trade_time_r: 2_000},
        {commission: '0.35', conid: '265598', order_id: 55, price: '200', side: 'B', size: 3, trade_time_r: 1_000},
      ]);

      const fill = await broker.getFillByOrderId(pair, '55');

      expect(fill?.size, 'both executions belong to the one order').toBe('4');
      expect(fill?.price, '(1*100 + 3*200) / 4').toBe('175');
      expect(fill?.fee, 'commission is charged per execution').toBe('0.7');
      expect(fill?.created_at, 'the order started at its earliest execution').toBe(new Date(1_000).toISOString());
    });

    it('returns undefined when the order has not executed', async () => {
      mockMethods.getPortfolioAccounts.mockResolvedValue([{currency: 'EUR', id: 'U1'}]);
      mockMethods.getTrades.mockResolvedValue([]);

      await expect(broker.getFillByOrderId(pair, '55')).resolves.toBeUndefined();
    });

    it('waits for a filled order’s executions to reach the lagging trades feed', async () => {
      vi.useFakeTimers();
      try {
        mockMethods.getPortfolioAccounts.mockResolvedValue([{currency: 'EUR', id: 'U1'}]);
        mockMethods.getLiveOrders.mockResolvedValue({
          orders: [{conid: '265598', orderId: '55', status: 'Filled'}],
          snapshot: true,
        });
        mockMethods.getTrades
          .mockResolvedValueOnce([])
          .mockResolvedValue([
            {commission: '0.35', conid: '265598', order_id: 55, price: '100', side: 'B', size: 1, trade_time_r: 1_000},
          ]);

        const pending = broker.getFillByOrderId(pair, '55');
        await vi.advanceTimersByTimeAsync(IbkrBroker.FILL_PROPAGATION_POLL_MS);

        expect(
          (await pending)?.size,
          'IBKR reports the order Filled before its execution reaches getTrades, so the fill is re-asked until it lands'
        ).toBe('1');
      } finally {
        vi.useRealTimers();
      }
    });

    it('does not wait on a cancelled order, which has no execution coming', async () => {
      mockMethods.getLiveOrders.mockResolvedValue({
        orders: [{conid: '265598', orderId: '55', status: 'Cancelled'}],
        snapshot: true,
      });

      await expect(broker.getFillByOrderId(pair, '55')).resolves.toBeUndefined();
      expect(
        mockMethods.getTrades,
        'a cancelled order has no fill, so the trades feed is not even consulted'
      ).not.toHaveBeenCalled();
    });
  });

  describe('getFeeAsset', () => {
    it('labels fees in the instrument currency, not the account currency', async () => {
      mockMethods.getPortfolioAccounts.mockResolvedValue([{currency: 'EUR', id: 'U1'}]);
      mockMethods.getTrades.mockResolvedValue([
        {commission: '0.35', conid: '265598', order_id: 55, price: '100', side: 'B', size: 1, trade_time_r: 1_000},
      ]);

      const [fill] = await broker.getFills(pair);

      expect(
        fill?.feeAsset,
        'IBKR bills a US stock in USD even from a EUR account: its preview says "1.00 USD", and the realised 0.12 was funded by a separate EUR sale on IDEALPRO. Labelling it EUR makes a fee uncomparable with the price it is charged against'
      ).toBe('USD');
    });
  });

  describe('getFillByOrderId', () => {
    it('reports nothing while the order is still working', async () => {
      mockMethods.getLiveOrders.mockResolvedValue({
        orders: [{conid: '265598', orderId: '55', status: 'Submitted'}],
        snapshot: true,
      });
      mockMethods.getTrades.mockResolvedValue([
        {commission: '0.35', conid: '265598', order_id: 55, price: '100', side: 'B', size: 1, trade_time_r: 1_000},
      ]);

      await expect(
        broker.getFillByOrderId(pair, '55'),
        'a partially filled order already has executions, and reporting them reads a four-share order as filled on its first share'
      ).resolves.toBeUndefined();
    });
  });

  describe('listBalances', () => {
    it('reads every page of positions', async () => {
      mockMethods.getLedger.mockResolvedValue({});
      const fullPage = Array.from({length: 30}, (_unused, index) => ({
        conid: index,
        contractDesc: `S${index}`,
        position: 1,
      }));
      mockMethods.getPositions
        .mockResolvedValueOnce(fullPage)
        .mockResolvedValueOnce([{conid: 99, contractDesc: 'LAST', position: 1}]);

      const balances = await broker.listBalances();

      expect(
        balances.some(balance => balance.currency === 'LAST'),
        'IBKR pages positions at 30, and stopping at the first page reports a larger account as flat'
      ).toBe(true);
    });
  });

  describe('getOpenOrders', () => {
    it('refuses an order list IBKR says is incomplete', async () => {
      mockMethods.getLiveOrders.mockResolvedValue({orders: [], snapshot: false});

      await expect(
        broker.getOpenOrders(pair),
        'an empty-but-incomplete list makes cancelOpenOrders report success having cancelled nothing'
      ).rejects.toThrow(/did not finish assembling/);
    });
  });

  describe('getTradingRules', () => {
    it('uses the price tick that is legal in every one of IBKR’s bands', async () => {
      mockMethods.getContractInfoAndRules.mockResolvedValue({
        currency: 'USD',
        rules: {
          increment: 0.05,
          incrementRules: [
            {increment: 0.01, lowerEdge: 0},
            {increment: 0.05, lowerEdge: 100},
          ],
        },
      });

      const rules = await broker.getTradingRules(pair);

      expect(
        rules.counter_increment,
        'the neutral rules hold one scalar, so it must be the coarsest tick: advertising 0.01 invites a price like 100.01 that the band above 100 rejects, and both order sizing and getProfitableExitPrice would then produce an unplaceable price'
      ).toBe('0.05');
    });

    it('trades in whole shares when the contract allows no fractional orders', async () => {
      mockMethods.getContractInfoAndRules.mockResolvedValue({currency: 'USD', rules: {fraqTypes: [], increment: 0.01}});

      const rules = await broker.getTradingRules(pair);

      expect(rules.base_increment).toBe('1');
      expect(rules.base_min_size).toBe('1');
    });

    it('ignores sizeIncrement, which is an order-ticket spinner step and not a tradable minimum', async () => {
      mockMethods.getContractInfoAndRules.mockResolvedValue({
        currency: 'USD',
        rules: {defaultSize: 100, fraqTypes: [], increment: 0.01, sizeIncrement: 40},
      });

      const rules = await broker.getTradingRules(pair);

      expect(rules.base_min_size, 'IBKR reports sizeIncrement 40 for AAPL, which trades one share at a time').toBe('1');
    });

    it('allows a fractional order down to the contract’s decimal places', async () => {
      mockMethods.getContractInfoAndRules.mockResolvedValue({
        currency: 'USD',
        rules: {fraqInt: 4, fraqTypes: ['limit', 'market'], increment: 0.01, sizeIncrement: 40},
      });

      const rules = await broker.getTradingRules(pair);

      expect(rules.base_increment, 'fraqInt 4 means four decimal places').toBe('0.0001');
      expect(rules.base_min_size).toBe('0.0001');
    });

    it('does not use exponent notation for a very fine fractional step', async () => {
      mockMethods.getContractInfoAndRules.mockResolvedValue({
        currency: 'USD',
        rules: {fraqInt: 8, fraqTypes: ['market'], increment: 0.01},
      });

      const rules = await broker.getTradingRules(pair);

      expect(rules.base_increment, 'a `1e-8` string would not survive being parsed as a decimal').toBe('0.00000001');
    });
  });

  describe('getFeeRates', () => {
    it('expresses the per-share commission as a rate against the current price', async () => {
      marketData.latestClose = '200';

      const rates = await broker.getFeeRates(pair);

      expect(
        rates[OrderType.MARKET].toString(),
        'USD 0.005 per share on a USD 200 share, which is the rate a large order pays'
      ).toBe('0.000025');
    });

    it('caps the rate at IBKR’s 1% of trade value', async () => {
      marketData.latestClose = '0.01';

      const rates = await broker.getFeeRates(pair);

      expect(rates[OrderType.MARKET].toString(), 'IBKR never charges more than 1% of trade value').toBe('0.01');
    });
  });

  describe('estimateFee', () => {
    it('prefers IBKR’s own projection over local arithmetic', async () => {
      mockMethods.getPortfolioAccounts.mockResolvedValue([{currency: 'EUR', id: 'U1'}]);
      mockMethods.previewOrder.mockResolvedValue({amount: {commission: '1.70 USD'}});

      const estimate = await broker.estimateFee(pair, OrderType.MARKET, new Big(1_000));

      expect(estimate.commission.toString(), 'the display suffix is stripped, the figure kept').toBe('1.7');
      expect(estimate.feeAsset, 'IBKR quotes and bills a US stock in USD').toBe('USD');
    });

    it('previews a LIMIT order as a MARKET ticket', async () => {
      mockMethods.getPortfolioAccounts.mockResolvedValue([{currency: 'EUR', id: 'U1'}]);
      mockMethods.previewOrder.mockResolvedValue({amount: {commission: '0.11 USD'}});

      const estimate = await broker.estimateFee(pair, OrderType.LIMIT, new Big(11));

      expect(
        mockMethods.previewOrder.mock.calls[0]?.[1],
        'a LIMIT ticket without a price is refused with "Invalid order price fields", which would silently degrade the estimate to local arithmetic'
      ).toMatchObject({orderType: 'MKT'});
      expect(estimate.commission.toString(), 'IBKR’s projection still reaches the caller').toBe('0.11');
    });

    it('falls back to the local estimate when no preview is available', async () => {
      mockMethods.getPortfolioAccounts.mockResolvedValue([{currency: 'EUR', id: 'U1'}]);
      mockMethods.previewOrder.mockRejectedValue(new Error('no session'));
      marketData.latestClose = '200';

      const estimate = await broker.estimateFee(pair, OrderType.MARKET, new Big(1_000));

      expect(
        estimate.total.toString(),
        'USD 1,000 of a USD 200 share is 5 shares: 0.025 of per-share commission, lifted to the USD 1.00 order floor. A flat rate would have said 0.025 and understated it 40-fold'
      ).toBe('1');
    });

    it('applies the floor and the cap that no single rate can express', async () => {
      mockMethods.getPortfolioAccounts.mockResolvedValue([{currency: 'EUR', id: 'U1'}]);
      mockMethods.previewOrder.mockRejectedValue(new Error('no session'));
      marketData.latestClose = '11.5';

      const oneShare = await broker.estimateFee(pair, OrderType.MARKET, new Big('11.5'));
      const hundredShares = await broker.estimateFee(pair, OrderType.MARKET, new Big('1150'));

      expect(
        oneShare.total.toString(),
        'the 1% cap beats the USD 1.00 floor on a small order, and IBKR previews this exact ticket at 0.12'
      ).toBe('0.12');
      expect(hundredShares.total.toString(), 'the floor binds once 1% of notional exceeds it').toBe('1');
    });

    it('reads the upper bound of a commission IBKR will not pin down', async () => {
      mockMethods.getPortfolioAccounts.mockResolvedValue([{currency: 'EUR', id: 'U1'}]);
      mockMethods.previewOrder.mockResolvedValue({amount: {commission: '0.23 ... 0.24 USD'}});

      const estimate = await broker.estimateFee(pair, OrderType.LIMIT, new Big('23'));

      expect(
        estimate.commission.toString(),
        'stripping non-digits made this "0.23...0.24", whose throw was swallowed into the offline fallback'
      ).toBe('0.24');
    });
  });

  describe('watchOrders', () => {
    it('emits the instrument fill without the conversions that funded it', async () => {
      vi.useFakeTimers();
      mockMethods.getPortfolioAccounts.mockResolvedValue([{currency: 'EUR', id: 'U1'}]);
      mockMethods.getContractInfoAndRules.mockResolvedValue({currency: 'USD'});
      // Primed empty, so everything arriving afterwards counts as new.
      mockMethods.getTrades.mockResolvedValue([]);

      const seen: Fill[] = [];
      const topicId = await broker.watchOrders();
      broker.on(topicId, (fill: Fill) => seen.push(fill));
      await vi.advanceTimersByTimeAsync(IbkrBroker.ORDER_POLL_INTERVAL_MS + 100);

      /** What one Ford buy actually produced on this EUR account. */
      mockMethods.getTrades.mockResolvedValue([
        {
          commission: '0.0',
          conid: 12_087_792,
          execution_id: 'fx-1',
          price: '1.09868',
          sec_type: 'CASH',
          side: 'S',
          size: 0.11,
          symbol: 'EUR',
          trade_time_r: 1_794_925_928_000,
        },
        {
          commission: '0.12',
          conid: 9_599_491,
          execution_id: 'stk-1',
          order_id: 2_017_174_765,
          price: '11.55',
          sec_type: 'STK',
          side: 'B',
          size: 1,
          symbol: 'F',
          trade_time_r: 1_794_925_927_000,
        },
        {
          commission: '0.0',
          conid: 12_087_792,
          execution_id: 'fx-2',
          price: '1.09872',
          sec_type: 'CASH',
          side: 'S',
          size: 10.51,
          symbol: 'EUR',
          trade_time_r: 1_794_925_928_000,
        },
      ]);
      await vi.advanceTimersByTimeAsync(IbkrBroker.ORDER_POLL_INTERVAL_MS + 100);

      expect(
        seen.map(fill => fill.pair.asString('/')),
        'the IDEALPRO conversions are IBKR funding the trade, so emitting them would have a strategy book sells it never placed'
      ).toStrictEqual(['F/USD']);
      expect(seen[0]?.price).toBe('11.55');
      expect(seen[0]?.fee).toBe('0.12');

      broker.unwatchOrders(topicId);
      vi.useRealTimers();
    });
  });

  describe('isLoopback', () => {
    it('keeps certificate verification on for anything but this machine', async () => {
      const {IbkrAPI: RealIbkrAPI} = await vi.importActual<ActualIbkrAPIModule>('./api/IbkrAPI.js');

      expect(RealIbkrAPI.isLoopback('https://localhost:5001')).toBe(true);
      expect(RealIbkrAPI.isLoopback('https://127.0.0.1:5001')).toBe(true);
      expect(
        RealIbkrAPI.isLoopback('https://gateway.example.com:5000'),
        'a remote gateway crosses a network, where the certificate is the only thing proving who answered'
      ).toBe(false);
      expect(RealIbkrAPI.isLoopback('not a url'), 'an unparseable address cannot be shown to be local').toBe(false);
    });
  });

  describe('commissionFor', () => {
    /**
     * Ford at USD 11.50, against this account's own `whatif` previews. Where IBKR answered with a
     * range it is quoted in `ibkr`, and the schedule reproduces its lower bound; the realised fill
     * took the schedule's side, charging 0.12 on 1% of 11.55 rather than a cent more.
     */
    const measured: {commission: string; ibkr: string; quantity: number}[] = [
      {commission: '0.12', ibkr: '0.12 USD', quantity: 1},
      {commission: '0.23', ibkr: '0.23 ... 0.24 USD', quantity: 2},
      {commission: '0.58', ibkr: '0.58 ... 0.59 USD', quantity: 5},
      {commission: '1', ibkr: '1.00 USD', quantity: 10},
      {commission: '1', ibkr: '1.00 USD', quantity: 25},
      {commission: '1', ibkr: '1.00 USD', quantity: 50},
      {commission: '1', ibkr: '1.00 USD', quantity: 100},
    ];

    it.each(measured)('bills $commission for $quantity shares, where IBKR quotes $ibkr', ({commission, quantity}) => {
      const price = new Big('11.5');

      expect(ibkrCommissionFor(price.mul(quantity), price).toString()).toBe(commission);
    });

    it('treats an empty order as free rather than charging the floor', () => {
      expect(ibkrCommissionFor(new Big(0), new Big('11.5')).toString()).toBe('0');
      expect(
        ibkrCommissionFor(new Big(100), new Big(0)).toString(),
        'an unknown price cannot be turned into a share count'
      ).toBe('0');
    });
  });

  describe('parseCommission', () => {
    it('reads the formats IBKR actually sends', () => {
      expect(parseIbkrCommission('1.70 USD')?.toString()).toBe('1.7');
      expect(parseIbkrCommission('0.35')?.toString()).toBe('0.35');
      expect(
        parseIbkrCommission('0.11 ... 0.12 USD')?.toString(),
        'the upper bound keeps an estimate from being optimistic'
      ).toBe('0.12');
      expect(parseIbkrCommission(undefined)).toBeUndefined();
      expect(parseIbkrCommission('USD'), 'no figure means no estimate, not zero').toBeUndefined();
    });
  });

  describe('getProfitableExitPrice', () => {
    it('prices the Ford exit from IBKR’s own flat commission', async () => {
      const fordPair = new TradingPair('F', 'USD');
      mockMethods.searchContracts.mockResolvedValue([{conid: '9599491', sections: [{secType: 'STK'}], symbol: 'F'}]);
      mockMethods.getPortfolioAccounts.mockResolvedValue([{currency: 'EUR', id: 'U1'}]);
      mockMethods.getContractInfoAndRules.mockResolvedValue({
        currency: 'USD',
        rules: {increment: 0.01, incrementRules: [{increment: 0.01, lowerEdge: 0}]},
      });
      // IBKR quotes 0.12 whether the ticket is 11.55 or 11.80 — a flat fee no rate can express.
      mockMethods.previewOrder.mockResolvedValue({amount: {commission: '0.12 USD'}});

      const result = await broker.getProfitableExitPrice(fordPair, {fee: '0.12', price: '11.55', size: '1'});

      expect(result.entryValue.toFixed(2), '11.55 paid plus 0.12 commission').toBe('11.67');
      expect(
        result.price.toFixed(2),
        'the live position: basis 11.67 and a 0.12 exit fee need 11.79, which rounds up to the cent tick'
      ).toBe('11.80');
      expect(result.currency, 'IBKR bills a US stock in USD').toBe('USD');
      expect(result.profit.gte(new Big('0.01')), 'a take-profit that realises a loss is the bug this prevents').toBe(
        true
      );
    });
  });

  describe('listBalances', () => {
    it('combines cash per currency with open positions', async () => {
      mockMethods.getLedger.mockResolvedValue({
        BASE: {cashbalance: 1_000, currency: 'EUR', settledcash: 1_000},
        EUR: {cashbalance: 1_000, currency: 'EUR', settledcash: 900},
      });
      mockMethods.getPositions.mockResolvedValue([{conid: 265598, position: 4, ticker: 'AAPL'}]);

      const balances = await broker.listBalances();

      expect(balances.map(balance => balance.currency)).toEqual(['EUR', 'AAPL']);
      expect(balances[0]?.available).toBe('900');
      expect(balances[1]?.available).toBe('4');
    });
  });

  describe('disconnect', () => {
    it('stops the order watcher it started', async () => {
      mockMethods.getTrades.mockResolvedValue([]);
      const topicId = await broker.watchOrders();

      broker.disconnect();

      expect(broker.listenerCount(topicId), 'a stopped watcher leaves no listeners behind').toBe(0);
    });
  });
});
