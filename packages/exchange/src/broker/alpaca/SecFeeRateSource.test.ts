import type {AxiosInstance} from 'axios';
import Big from 'big.js';
import {describe, expect, it, vi} from 'vitest';
import {SEC_FEE_RATES} from './AlpacaFees.js';
import {parseSecFeeRateOrder, SecFeeRateSource} from './SecFeeRateSource.js';

/** The operative sentence, verbatim from the FY2027 slot we expect the SEC to fill next. */
function orderText(perMillion: string, effectiveOn: string) {
  return `IV. Conclusion Accordingly, pursuant to Section 31 of the Exchange Act, It is hereby ordered
    that the fee rates applicable under Sections 31(b) and (c) of the Exchange Act shall be
    $${perMillion} per $1,000,000 effective on ${effectiveOn}. By the Commission.`;
}

function stubClient(handlers: {search: unknown; texts: Record<string, string>}) {
  const get = vi.fn<AxiosInstance['get']>(async (url: string) => {
    if (url.includes('documents.json')) {
      return {data: handlers.search} as never;
    }
    return {data: handlers.texts[url] ?? ''} as never;
  });
  return {client: {get} as unknown as AxiosInstance, get};
}

const NEWEST_VENDORED = SEC_FEE_RATES.at(-1)!.from;

describe('SecFeeRateSource', () => {
  describe('parseSecFeeRateOrder', () => {
    it('reads the rate and effective date out of the ordering sentence', () => {
      const rate = parseSecFeeRateOrder(orderText('20.60', 'April 4, 2026'));

      expect(rate?.from).toBe('2026-04-04');
      expect(rate?.rate.toFixed(), '$20.60 per million expressed per dollar').toBe('0.0000206');
    });

    it('reads the ordered zero rather than the negative rate the formula produced', () => {
      /*
       * The real FY2025 order computes -$23.40 per million, explains that a negative fee rate
       * cannot be effectuated, then orders $0.00. A parser that grabs any dollar figure in the
       * document gets -23.40 or the outgoing 27.80 instead.
       */
      const document = `
        yielding a rate of -0.00002340 (or -$23.40 per million). Neither the calculation
        methodology nor section 31 of the Exchange Act contemplates a negative fee rate, and the
        Commission cannot effectuate a negative fee rate. For these reasons, the fee rate is thus
        instead set to $0.00 per million. The prior rate of $27.80 per million remains in effect
        through May 13, 2025.
        ${orderText('0.00', 'May 14, 2025')}`;

      expect(parseSecFeeRateOrder(document)?.rate.toFixed(), 'the ordered rate, not the arithmetic').toBe('0');
    });

    it('accepts the lower-case wording older orders use', () => {
      const document = `It is hereby ordered that the fee rate applicable under sections 31(b) and (c)
        of the Exchange Act shall be $8.00 per $1,000,000 effective on February 27, 2023.`;

      expect(parseSecFeeRateOrder(document)?.from).toBe('2023-02-27');
    });

    it('declines a document without the ordering sentence', () => {
      const correction = `SUMMARY: The Commission published a document concerning Order Making Fiscal
        Year 2026 Annual Adjustments to Transaction Fee Rates. The document contained a
        typographical error. The rate of $20.60 per million is unaffected.`;

      expect(parseSecFeeRateOrder(correction), 'correction notices amend the appendix, not the rate').toBeUndefined();
    });

    it('declines an implausible rate, which means the layout changed', () => {
      expect(parseSecFeeRateOrder(orderText('9999.00', 'April 4, 2026'))).toBeUndefined();
    });
  });

  describe('refresh', () => {
    it('appends a window published after the newest vendored one', async () => {
      const {client} = stubClient({
        search: {results: [{document_number: '2027-1', publication_date: '2027-03-01', raw_text_url: 'text://fy27'}]},
        texts: {'text://fy27': orderText('31.20', 'April 10, 2027')},
      });
      const source = new SecFeeRateSource({client});

      const added = await source.refresh();

      expect(added).toHaveLength(1);
      expect(added[0]?.from).toBe('2027-04-10');
      expect(source.getRates().at(-1)?.rate.toFixed()).toBe('0.0000312');
      expect(source.getRates().slice(0, SEC_FEE_RATES.length), 'vendored windows are left untouched').toEqual([
        ...SEC_FEE_RATES,
      ]);
    });

    it('drops a window that would rewrite an existing one', async () => {
      const {client} = stubClient({
        search: {results: [{document_number: 'x', publication_date: '2026-03-04', raw_text_url: 'text://replay'}]},
        // An effective date at or before the newest vendored window.
        texts: {'text://replay': orderText('99.00', 'January 1, 2024')},
      });
      const source = new SecFeeRateSource({client});

      const added = await source.refresh();

      expect(added, 'history stays reproducible, so a past fill prices the same on every run').toHaveLength(0);
      expect(source.getRates()).toEqual([...SEC_FEE_RATES]);
    });

    it('keeps the vendored table when the network fails', async () => {
      const get = vi.fn<AxiosInstance['get']>().mockRejectedValue(new Error('ENOTFOUND'));
      const source = new SecFeeRateSource({client: {get} as unknown as AxiosInstance});
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      await expect(source.refresh(), 'a fee estimate must not be able to fail a fill').resolves.toEqual([]);
      expect(source.getRates()).toEqual([...SEC_FEE_RATES]);
    });

    it('keeps the vendored table when a document no longer parses', async () => {
      const {client} = stubClient({
        search: {results: [{document_number: 'x', publication_date: '2027-03-01', raw_text_url: 'text://reworded'}]},
        texts: {'text://reworded': 'The Commission has adopted a new rate. See the appendix.'},
      });
      const source = new SecFeeRateSource({client});

      expect(await source.refresh()).toEqual([]);
      expect(source.getRates()).toEqual([...SEC_FEE_RATES]);
    });

    it('asks only for orders published since the newest window it already has', async () => {
      const {client, get} = stubClient({search: {}, texts: {}});
      const source = new SecFeeRateSource({client});

      await source.refresh();

      const params = get.mock.calls[0]?.[1]?.params as Record<string, string>;
      expect(params['conditions[publication_date][gte]'], 'an order is published before it takes effect').toBe(
        NEWEST_VENDORED
      );
    });

    it('does not hit the network again inside the TTL', async () => {
      const {client, get} = stubClient({search: {}, texts: {}});
      const source = new SecFeeRateSource({client, ttl: 60_000});

      await source.refresh(1_000);
      await source.refresh(30_000);

      expect(get, 'a per-fill refresh must not become a per-fill request').toHaveBeenCalledTimes(1);

      await source.refresh(70_000);
      expect(get).toHaveBeenCalledTimes(2);
    });
  });

  it('prices a fill with the vendored table before any refresh happens', () => {
    const source = new SecFeeRateSource();
    expect(source.getRates(), 'construction must not require a network round trip').toEqual([...SEC_FEE_RATES]);
    expect(source.getRates().at(-1)?.rate).toEqual(new Big('0.0000206'));
  });
});
