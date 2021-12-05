import {BigIndicatorSeries} from '../Indicator';
import Big from 'big.js';
import {AO} from '../AO/AO';
import {SMA} from '../SMA/SMA';
import {MOM} from '../MOM/MOM';
import {HighLow} from '../util';

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

  constructor(public readonly shortAO: number, public readonly longAO: number, public readonly signalInterval: number) {
    super();
    this.ao = new AO(shortAO, longAO);
    this.signal = new SMA(signalInterval);
    this.momentum = new MOM(1);
  }

  override update(input: HighLow): void | Big {
    const ao = this.ao.update(input);
    if (ao) {
      this.signal.update(ao);
      if (this.signal.isStable) {
        const result = this.setResult(ao.sub(this.signal.getResult()));
        this.momentum.update(result);
        return this.result;
      }
    }
  }
}
