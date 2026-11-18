import Big from 'big.js';
import {describe, expect, it} from 'vitest';
import {adoptedPosition, afterExitFill, emptyLedger, resizedToOwned} from './ledger.js';

const MINIMUM = new Big('0.01');

describe('afterExitFill', () => {
  const holding = {...emptyLedger(), costBasis: '1000', size: '10'};

  it('keeps the rest of a partial exit priced at what it cost', () => {
    const next = afterExitFill(holding, {price: new Big('120'), receivedSize: new Big('4')}, MINIMUM);

    expect(next?.size).toBe('6');
    expect(next?.costBasis, 'what is left still cost 100 each, whatever the part that just sold went for').toBe('600');
  });

  it('treats a remainder too small to sell as a closed position', () => {
    /*
     * Selling everything is rounded down to the exchange's increment, so a sell-all can leave dust
     * behind. Counting it as a position still held would keep a terminal exit open forever and let
     * a later candle's close stand as the price the position left at.
     */
    const next = afterExitFill(holding, {price: new Big('120'), receivedSize: new Big('9.999')}, MINIMUM);

    expect(next?.size, 'the dust is written off').toBe('0');
    expect(next?.exits, 'and the exit counts').toBe(1);
    expect(next?.lastExitPrice, 'at the price the sale actually got').toBe('120');
  });

  it('has nothing to do for a sell while flat', () => {
    expect(afterExitFill(emptyLedger(), {price: new Big('120'), receivedSize: new Big('1')}, MINIMUM)).toBeNull();
  });
});

describe('resizedToOwned', () => {
  const holding = {...emptyLedger(), costBasis: '1000', size: '10'};
  const close = new Big('120');

  it('has nothing to do while the holding is the size it is tracked at', () => {
    expect(resizedToOwned(holding, new Big('10'), close)).toBeNull();
  });

  it('keeps the entry price of what is left of a holding sold into', () => {
    const next = resizedToOwned(holding, new Big('4'), close);

    expect(next?.size).toBe('4');
    expect(next?.costBasis, 'the part still held was bought at 100, whatever the price is today').toBe('400');
  });

  it('follows a holding that was topped up outside the strategy', () => {
    const next = resizedToOwned(holding, new Big('12'), close);

    expect(next?.size, 'a threshold per unit divides by the size, so an untracked top-up exits late').toBe('12');
    expect(
      next?.costBasis,
      'the two units that appeared are priced where they were found, as an adopted position is'
    ).toBe('1240');
  });
});

describe('adoptedPosition', () => {
  it('anchors at the price the position was found at, not at the candle high', () => {
    const adopted = adoptedPosition({close: new Big('100')}, new Big('1'));

    expect(
      adopted.bestPrice,
      'a candle high above it happened before this strategy held anything, so it is not a best price it saw'
    ).toBe('100');
    expect(adopted.costBasis, 'and what it is worth is what it would fetch now').toBe('100');
  });
});
