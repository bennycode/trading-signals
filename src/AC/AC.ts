import {AO, FasterAO} from '../AO/AO.js';
import {BigIndicatorSeries, NumberIndicatorSeries} from '../Indicator.js';
import {FasterMOM, MOM} from '../MOM/MOM.js';
import {FasterSMA, SMA} from '../SMA/SMA.js';
import type {HighLow} from '../util/index.js';

/**
 * Accelerator Oscillator (AC)
 * Type: Momentum
 *
 * The Accelerator Oscillator (AC) is an indicator used to detect when a momentum changes. It has been developed by
 * Bill Williams. If the momentum in an uptrend is starting to slow down, that could suggest that there is less
 * interest in the asset. This typically leads to selling. In the inverse, momentum to the downside will start to slow
 * down before buy orders come in. The Accelerator Oscillator also looks at whether there is an acceleration in the
 * change of momentum.
 *
 * @see https://www.thinkmarkets.com/en/indicators/bill-williams-accelerator/
 */
export class AC extends BigIndicatorSeries<HighLow> {
  public readonly ao: AO;
  public readonly momentum: MOM;
  public readonly signal: SMA;

  constructor(
    public readonly shortAO: number,
    public readonly longAO: number,
    public readonly signalInterval: number
  ) {
    super();
    this.ao = new AO(shortAO, longAO);
    this.momentum = new MOM(1);
    this.signal = new SMA(signalInterval);
  }

  override getRequiredInputs() {
    return this.signal.getRequiredInputs();
  }

  update(input: HighLow, replace: boolean) {
    const ao = this.ao.update(input, replace);
    if (ao) {
      this.signal.update(ao, replace);
      if (this.signal.isStable) {
        const result = this.setResult(ao.sub(this.signal.getResultOrThrow()), replace);
        this.momentum.update(result, replace);
        return result;
      }
    }
    return null;
  }
}

export class FasterAC extends NumberIndicatorSeries<HighLow<number>> {
  public readonly ao: FasterAO;
  public readonly momentum: FasterMOM;
  public readonly signal: FasterSMA;

  constructor(
    public readonly shortAO: number,
    public readonly longAO: number,
    public readonly signalInterval: number
  ) {
    super();
    this.ao = new FasterAO(shortAO, longAO);
    this.momentum = new FasterMOM(1);
    this.signal = new FasterSMA(signalInterval);
  }

  override getRequiredInputs() {
    return this.signal.getRequiredInputs();
  }

  update(input: HighLow<number>, replace: boolean) {
    const ao = this.ao.update(input, replace);
    if (ao) {
      this.signal.update(ao, replace);
      if (this.signal.isStable) {
        const result = this.setResult(ao - this.signal.getResultOrThrow(), replace);
        this.momentum.update(result, replace);
        return result;
      }
    }
    return null;
  }
}
