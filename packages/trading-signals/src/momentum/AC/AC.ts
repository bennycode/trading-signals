import {SMA} from '../../trend/SMA/SMA.js';
import type {HighLow} from '../../types/HighLowClose.js';
import {TrendIndicatorSeries, TradingSignal} from '../../types/Indicator.js';
import {AO} from '../AO/AO.js';
import {MOM} from '../MOM/MOM.js';

/**
 * Accelerator Oscillator (AC)
 * Type: Momentum
 *
 * The Accelerator Oscillator (AC) is an indicator used to detect when a momentum changes. It has been developed by Bill Williams. If the momentum in an uptrend is starting to slow down, that could suggest that there is less interest in the asset. This typically leads to selling. In the inverse, momentum to the downside will start to slow down before buy orders come in. The Accelerator Oscillator also looks at whether there is an acceleration in the change of momentum.
 *
 * @see https://www.thinkmarkets.com/en/indicators/bill-williams-accelerator/
 * @see https://help.quantower.com/quantower/analytics-panels/chart/technical-indicators/oscillators/accelerator-oscillator
 */
export class AC extends         TrendIndicatorSeries<HighLow<number>> {
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
    return this.ao.getRequiredInputs() + this.signal.getRequiredInputs();
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

  protected calculateSignalState(result: number | null | undefined) {
    const hasResult = result !== null && result !== undefined;
    const isPositive = hasResult && result > 0;

    switch (true) {
      case !hasResult:
        return TradingSignal.UNKNOWN;
      case isPositive:
        return TradingSignal.BULLISH;
      default:
        return TradingSignal.BEARISH;
    }
  }
}
