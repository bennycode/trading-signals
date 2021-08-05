import {SimpleIndicator} from '../Indicator';
import Big, {BigSource} from 'big.js';
import {NotEnoughDataError} from '../error';
import {AO} from '../AO/AO';
import {SMA} from '../SMA/SMA';
import {MOM} from '../MOM/MOM';

/**
 * The Accelerator Oscillator (AC) is an indicator used to detect when a momentum changes. It has been developed by
 * Bill Williams. If the momentum in an uptrend is starting to slow down, that could suggest that there is less
 * interest in the asset. This typically leads to selling. In the inverse, momentum to the downside will start to slow
 * down before buy orders come in. The Accelerator Oscillator also looks at whether there is an acceleration in the
 * change of momentum.
 */
export class AC implements SimpleIndicator {
  public readonly ao: AO;
  public readonly momentum: MOM;
  public readonly signal: SMA;

  private result: Big | undefined;

  constructor(public readonly shortAO: number, public readonly longAO: number, public readonly signalInterval: number) {
    this.ao = new AO(shortAO, longAO);
    this.signal = new SMA(signalInterval);
    this.momentum = new MOM(1);
  }

  get isStable(): boolean {
    return this.result !== undefined;
  }

  getResult(): Big {
    if (!this.result) {
      throw new NotEnoughDataError();
    }

    return this.result;
  }

  update(low: BigSource, high: BigSource): void {
    this.ao.update(low, high);
    if (this.ao.isStable) {
      const ao = this.ao.getResult();
      this.signal.update(ao);
      if (this.signal.isStable) {
        this.result = ao.sub(this.signal.getResult());
        this.momentum.update(this.result);
      }
    }
  }
}
