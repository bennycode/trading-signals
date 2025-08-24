import {AO} from '../AO/AO.js';
import {IndicatorSeries} from '../../types/Indicator.js';
import {MOM} from '../MOM/MOM.js';
import {SMA} from '../../trend/SMA/SMA.js';
import type {HighLow} from '../../types/HighLowClose.js';

/**
 * Accelerator Oscillator (AC)
 * Type: Momentum
 *
 * The Accelerator Oscillator (AC) is an indicator used to detect when a momentum changes. It has been developed by Bill Williams. If the momentum in an uptrend is starting to slow down, that could suggest that there is less interest in the asset. This typically leads to selling. In the inverse, momentum to the downside will start to slow down before buy orders come in. The Accelerator Oscillator also looks at whether there is an acceleration in the change of momentum.
 *
 * @see https://www.thinkmarkets.com/en/indicators/bill-williams-accelerator/
 */
export class AC extends IndicatorSeries<HighLow<number>> {
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
