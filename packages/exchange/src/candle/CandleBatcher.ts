import {Big} from 'big.js';
import {EventEmitter} from 'node:events';
import {ms, StringValue} from 'ms';
import jsonabc from 'jsonabc';
import {BatchedCandle, ONE_MINUTE_IN_MS, OneMinuteBatchedCandle} from './BatchedCandle.js';
import {Candle} from '../broker/Broker.js';

type EventMap = {
  batchedCandle: [candle: BatchedCandle];
};

export class CandleBatcher extends EventEmitter<EventMap> {
  #batch: Candle[] = [];
  readonly #desiredIntervalInMillis: number;

  constructor(desiredIntervalInMillis: number) {
    super();
    this.#desiredIntervalInMillis = desiredIntervalInMillis;
  }

  get present(): number {
    return this.#batch.length;
  }

  static amountOfCandles(intervalInMillis: number | StringValue, timespanInMillis: number | StringValue) {
    const interval: number = typeof intervalInMillis === 'number' ? intervalInMillis : ms(intervalInMillis);
    const timespan: number = typeof timespanInMillis === 'number' ? timespanInMillis : ms(timespanInMillis);
    return timespan / interval;
  }

  static isBatchedCandle(candle: Candle | BatchedCandle): candle is BatchedCandle {
    return typeof candle.open !== 'string';
  }

  static isOneMinuteCandle(candle: BatchedCandle): candle is OneMinuteBatchedCandle {
    return candle.sizeInMillis === ONE_MINUTE_IN_MS;
  }

  static createOneMinuteBatchedCandle(batch: Candle[]): OneMinuteBatchedCandle {
    return {
      ...CandleBatcher.createBatchedCandle(batch, ONE_MINUTE_IN_MS),
      sizeInMillis: ONE_MINUTE_IN_MS,
    };
  }

  static createBatchedCandle(batch: Candle[], desiredIntervalInMillis: number): BatchedCandle {
    const openTimesArray = batch.map(candle => candle.openTimeInMillis);
    batch = batch.filter((candle, index) => index === openTimesArray.indexOf(candle.openTimeInMillis));
    const firstCandle: Candle = batch[0];
    const lastCandle: Candle = batch[batch.length - 1];
    const isPositive = new Big(lastCandle.close).gt(firstCandle.open);

    const accumulator: BatchedCandle = {
      base: firstCandle.base,
      change: new Big(1).minus(new Big(firstCandle.open).div(lastCandle.close)).times(100),
      close: new Big(lastCandle.close),
      closeAsk: new Big(lastCandle.closeAsk || lastCandle.close),
      counter: firstCandle.counter,
      high: new Big(firstCandle.high),
      highAsk: new Big(firstCandle.highAsk || firstCandle.high),
      isLatest: lastCandle.isLatest,
      isNegative: !isPositive,
      isPositive,
      low: new Big(firstCandle.low),
      lowAsk: new Big(firstCandle.lowAsk || firstCandle.low),
      medianPrice: new Big(0),
      open: new Big(firstCandle.open),
      openAsk: new Big(firstCandle.openAsk || firstCandle.open),
      openTimeInISO: firstCandle.openTimeInISO,
      openTimeInMillis: firstCandle.openTimeInMillis,
      sizeInMillis: desiredIntervalInMillis,
      volume: new Big(0),
      weightedMedianPrice: new Big(0),
    };

    const reducer = (accumulator: BatchedCandle, candle: Candle): BatchedCandle => {
      const {high, highAsk, low, lowAsk} = accumulator;
      candle.lowAsk ??= candle.low;
      candle.highAsk ??= candle.high;

      return {
        base: accumulator.base,
        change: accumulator.change,
        close: accumulator.close,
        closeAsk: accumulator.closeAsk,
        counter: accumulator.counter,
        high: high.gte(candle.high) ? high : new Big(candle.high),
        highAsk: highAsk.gte(candle.highAsk) ? highAsk : new Big(candle.highAsk),
        isLatest: accumulator.isLatest,
        isNegative: accumulator.isNegative,
        isPositive: accumulator.isPositive,
        low: low.lte(candle.low) ? low : new Big(candle.low),
        lowAsk: lowAsk.lte(candle.lowAsk) ? lowAsk : new Big(candle.lowAsk),
        medianPrice: accumulator.medianPrice,
        open: accumulator.open,
        openAsk: accumulator.openAsk,
        openTimeInISO: accumulator.openTimeInISO,
        openTimeInMillis: accumulator.openTimeInMillis,
        sizeInMillis: accumulator.sizeInMillis,
        volume: accumulator.volume.plus(candle.volume),
        // Weighted median price stays "0" and will be assigned later
        weightedMedianPrice: accumulator.weightedMedianPrice,
      };
    };

    const batchedCandle: BatchedCandle = batch.reduce(reducer, accumulator);

    // Note: There can be candles with a volume of "0.00000000"
    const weightedMedianPrice = batchedCandle.volume.eq(0)
      ? batchedCandle.close
      : batch
          .map(candle => {
            const medianPrice = new Big(candle.low).plus(candle.high).div(2);
            return new Big(candle.volume).mul(medianPrice);
          })
          .reduce((medianSum1, medianSum2) => medianSum1.plus(medianSum2))
          .div(batchedCandle.volume);

    batchedCandle.medianPrice = new Big(batchedCandle.high).plus(batchedCandle.low).div(2);
    batchedCandle.weightedMedianPrice = weightedMedianPrice;

    return batchedCandle;
  }

  /**
   * Add candles that should be batched. Once enough candles have been added, the function will return a batched
   * candle.
   *
   * Example: If you aim for a 1-hour batch, and you include 15-minute candles, this function will produce a 1-hour
   * candle once you've added four sets of 15-minute candles.
   */
  addToBatch(candle: Candle | BatchedCandle): BatchedCandle | undefined {
    const exchangeCandle = CandleBatcher.isBatchedCandle(candle) ? CandleBatcher.toCandle(candle) : candle;
    const {currentBatchArray, newBatch} = CandleBatcher.add(exchangeCandle, this.#batch, this.#desiredIntervalInMillis);
    this.#batch = currentBatchArray;

    if (newBatch) {
      this.emit('batchedCandle', newBatch);
    }

    return newBatch;
  }

  static batchMany(candles: Candle[], desiredIntervalInMillis: number): BatchedCandle[] {
    if (candles.length === 0) {
      return [];
    }
    const batchesArray: BatchedCandle[] = [];
    let currentBatchArray: Candle[] = [];
    for (const candle of candles) {
      const addCandle = CandleBatcher.add(candle, currentBatchArray, desiredIntervalInMillis);
      if (addCandle.newBatch !== undefined) {
        batchesArray.push(addCandle.newBatch);
      }
      currentBatchArray = addCandle.currentBatchArray;
    }
    if (currentBatchArray.length !== 0) {
      batchesArray.push(CandleBatcher.createBatchedCandle(currentBatchArray, desiredIntervalInMillis));
    }
    return batchesArray;
  }

  /**
   * Create a new candle which starts at the beginning of the desired interval (even when beginning candles have been
   * missed). Because of this fix, we won't get a shifted chart when candles are missing within an interval.
   */
  static adjustCandle(candle: Candle, desiredIntervalInMillis: number): Candle {
    // Make a deep copy of the candle to avoid in-place modifications
    const newCandle = {...candle};
    newCandle.openTimeInMillis = candle.openTimeInMillis - (candle.openTimeInMillis % desiredIntervalInMillis);
    newCandle.openTimeInISO = new Date(newCandle.openTimeInMillis).toISOString();
    return newCandle;
  }

  static add(
    candle: Candle,
    currentBatchArray: Candle[],
    desiredIntervalInMillis: number
  ): {
    currentBatchArray: Candle[];
    newBatch: BatchedCandle | undefined;
  } {
    if (new Big(candle.volume).eq(0)) {
      return {
        currentBatchArray: currentBatchArray,
        newBatch: undefined,
      };
    }
    if (currentBatchArray.length === 0) {
      const adjustedCandle = CandleBatcher.adjustCandle(candle, desiredIntervalInMillis);
      currentBatchArray.push(adjustedCandle);
      if (adjustedCandle.sizeInMillis === desiredIntervalInMillis) {
        return {
          currentBatchArray: [],
          newBatch: CandleBatcher.createBatchedCandle(currentBatchArray, desiredIntervalInMillis),
        };
      }
    } else {
      const firstCandle = currentBatchArray[0];
      const isNextInterval =
        candle.openTimeInMillis + candle.sizeInMillis - firstCandle.openTimeInMillis > desiredIntervalInMillis;
      const isEndOfCurrentInterval =
        candle.openTimeInMillis + candle.sizeInMillis - firstCandle.openTimeInMillis === desiredIntervalInMillis;
      if (isNextInterval || isEndOfCurrentInterval) {
        if (isEndOfCurrentInterval) {
          currentBatchArray.push(candle);
        }
        const newBatch = CandleBatcher.createBatchedCandle(currentBatchArray, desiredIntervalInMillis);

        if (isEndOfCurrentInterval) {
          currentBatchArray = [];
        } else {
          const adjustedCandle = CandleBatcher.adjustCandle(candle, desiredIntervalInMillis);
          currentBatchArray = [adjustedCandle];
        }
        return {
          currentBatchArray: currentBatchArray,
          newBatch,
        };
      }
      currentBatchArray.push(candle);
    }
    return {
      currentBatchArray: currentBatchArray,
      newBatch: undefined,
    };
  }

  static toBatchedCandles(candles: Candle[]): BatchedCandle[] {
    return CandleBatcher.batchMany(candles, candles[0].sizeInMillis);
  }

  static toBatchedCandle(candle: Candle): BatchedCandle {
    return CandleBatcher.batchMany([candle], candle.sizeInMillis)[0];
  }

  static toCandles(candles: BatchedCandle[]): Candle[] {
    return candles.map(CandleBatcher.toCandle);
  }

  static toCandle(candle: BatchedCandle): Candle {
    return {
      base: candle.base,
      close: candle.close.valueOf(),
      counter: candle.counter,
      high: candle.high.valueOf(),
      low: candle.low.valueOf(),
      open: candle.open.valueOf(),
      openTimeInISO: candle.openTimeInISO,
      openTimeInMillis: candle.openTimeInMillis,
      sizeInMillis: candle.sizeInMillis,
      volume: candle.volume.valueOf(),
    };
  }

  static override toString(candle: BatchedCandle): string {
    return JSON.stringify(
      jsonabc.sortObj({
        base: candle.base,
        close: candle.close.valueOf(),
        counter: candle.counter,
        high: candle.high.valueOf(),
        low: candle.low.valueOf(),
        medianPrice: candle.medianPrice.valueOf(),
        open: candle.open.valueOf(),
        openTimeInISO: candle.openTimeInISO,
        openTimeInMillis: candle.openTimeInMillis,
        sizeInMillis: candle.sizeInMillis,
        volume: candle.volume.valueOf(),
        weightedMedianPrice: candle.weightedMedianPrice.valueOf(),
      }),
      null,
      2
    );
  }

  static getHighAndLow(candles: Candle[]): {high: Big; low: Big} {
    const reducer = (accumulator: {high: Big; low: Big}, candle: Candle): {high: Big; low: Big} => {
      const {high, low} = accumulator;
      return {
        high: high.gte(candle.high) ? high : new Big(candle.high),
        low: low.lte(candle.low) ? low : new Big(candle.low),
      };
    };

    const [firstCandle] = candles;

    return candles.reduce(reducer, {
      high: new Big(firstCandle.high),
      low: new Big(firstCandle.low),
    });
  }
}
