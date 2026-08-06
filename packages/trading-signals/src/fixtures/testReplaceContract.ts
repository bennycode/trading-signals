import {describe, expect, it} from 'vitest';

type ReplaceContractOptions<Input> = {
  /** Creates a fresh instance of the indicator under test */
  create: () => {
    add(input: Input): unknown;
    getState(): object;
    replace(input: Input): unknown;
  };
  /** Input that must lead the indicator into a different state than the last of `inputs` */
  divergentInput: Input;
  /** Input series fed before exercising replace(); the last input is the one being replaced */
  inputs: readonly Input[];
};

/**
 * Registers the replace() contract every indicator must fulfil: replacing the latest input
 * with itself changes nothing, and replacing a divergent input restores the exact state of
 * an add-only series.
 */
export function testReplaceContract<Input>({create, divergentInput, inputs}: ReplaceContractOptions<Input>) {
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
