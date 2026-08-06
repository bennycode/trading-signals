import {describe, expect, it} from 'vitest';
import {NotEnoughDataError} from '../error/NotEnoughDataError.js';

type IndicatorContractOptions<Input> = {
  /** Creates a fresh instance of the indicator under test */
  create: () => {
    add(input: Input): unknown;
    getRequiredInputs(): number;
    getResult(): unknown;
    getResultOrThrow(): unknown;
    getState(): object;
    isStable: boolean;
    replace(input: Input): unknown;
  };
  /** Input that must lead the indicator into a different state than the last of `inputs` */
  divergentInput: Input;
  /** Input series fed before exercising replace(); the last input is the one being replaced */
  inputs: readonly Input[];
};

/**
 * Registers the contracts every indicator must fulfil. Warm-up: below the declared number of
 * required inputs there is no result, only a `NotEnoughDataError`. Replace: replacing the
 * latest input with itself changes nothing, and replacing a divergent input restores the
 * exact state of an add-only series.
 */
export function testIndicatorContract<Input>({create, divergentInput, inputs}: IndicatorContractOptions<Input>) {
  describe('warm-up contract', () => {
    it('stays unstable and yields no result before the declared warm-up', () => {
      const indicator = create();
      const requiredInputs = indicator.getRequiredInputs();

      expect(inputs.length, 'the contract inputs must cover the declared warm-up').toBeGreaterThanOrEqual(
        requiredInputs
      );

      const expectNoResult = (count: number) => {
        expect(indicator.isStable, `unstable after ${count} of ${requiredInputs} required inputs`).toBe(false);
        expect(indicator.getResult(), `no result after ${count} of ${requiredInputs} required inputs`).toBeNull();
        expect(() => indicator.getResultOrThrow()).toThrow(NotEnoughDataError);
      };

      expectNoResult(0);

      inputs.slice(0, requiredInputs - 1).forEach((input, index) => {
        indicator.add(input);
        expectNoResult(index + 1);
      });
    });
  });

  describe('replace() contract', () => {
    it('changes nothing when the latest input is replaced with itself', () => {
      const indicator = create();

      for (const input of inputs) {
        indicator.add(input);
      }

      const stateBefore = indicator.getState();
      indicator.replace(inputs[inputs.length - 1]);

      expect(indicator.getState(), 'replacing the latest input with itself is a no-op').toEqual(stateBefore);
    });

    it('reproduces the state of an add-only series after replacing a divergent input', () => {
      const reference = create();

      for (const input of inputs) {
        reference.add(input);
      }

      const replaced = create();

      for (const input of inputs.slice(0, -1)) {
        replaced.add(input);
      }

      replaced.add(divergentInput);

      expect(replaced.getState(), 'the divergent input leads to a different state').not.toEqual(reference.getState());

      replaced.replace(inputs[inputs.length - 1]);

      expect(replaced.getState(), 'a replacement reproduces the add-only series').toEqual(reference.getState());
    });
  });
}
