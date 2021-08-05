import {SimpleIndicator} from '../Indicator';
import Big, {BigSource} from 'big.js';
import {NotEnoughDataError} from '../error';
import {AO} from '../AO/AO';
import {SMA} from '../SMA/SMA';

/**
 * The Accelerator Oscillator (AC) is an indicator used to detect when a momentum changes. It has been developed by
 * Bill Williams. If the momentum in an uptrend is starting to slow down, that could suggest that there is less
 * interest in the asset. This typically leads to selling. In the inverse, momentum to the downside will start to slow
 * down before buy orders come in. The Accelerator Oscillator also looks at whether there is an acceleration in the
 * change of momentum.
 */
export class AC implements SimpleIndicator {
  private readonly ao: AO;
  private result: Big | undefined;
  private readonly signalSMA: SMA;

  constructor(public readonly shortAO: number, public readonly longAO: number, public readonly signalInterval: number) {
    this.ao = new AO(shortAO, longAO);
    this.signalSMA = new SMA(signalInterval);
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
      this.signalSMA.update(ao);
      if (this.signalSMA.isStable) {
        this.result = ao.sub(this.signalSMA.getResult());
      }
    }
  }
}
