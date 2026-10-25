import {describe, expect, it, vi} from 'vitest';
import {Strategy} from './Strategy.js';

type TestState = {
  counter: number;
  nested: {value: number};
};

class TestStrategy extends Strategy {
  static override NAME = 'test-strategy';

  constructor(state: TestState) {
    super({state});
  }

  get proxiedState(): TestState {
    return this.getProxiedState<TestState>();
  }

  protected override async processCandle(): Promise<void> {}
}

function makeStrategy() {
  const strategy = new TestStrategy({counter: 0, nested: {value: 1}});
  const onSave = vi.fn();
  strategy.onSave = onSave;
  return {onSave, strategy};
}

function getPersistedState(strategy: Strategy): Record<string, unknown> {
  const state = strategy.state;
  if (state === null) {
    throw new Error('Expected strategy state to be set');
  }
  return state;
}

describe('Strategy', () => {
  describe('setState', () => {
    it('merges the patch into the current state and fires onSave exactly once', () => {
      const {onSave, strategy} = makeStrategy();

      strategy.setState<TestState>({counter: 5, nested: {value: 2}});

      expect(strategy.state).toEqual({counter: 5, nested: {value: 2}});
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    it('keeps untouched keys and updates the proxied state view', () => {
      const {strategy} = makeStrategy();

      strategy.setState<TestState>({nested: {value: 42}});

      expect(strategy.state).toEqual({counter: 0, nested: {value: 42}});
      expect(strategy.proxiedState.nested.value).toBe(42);
    });
  });

  describe('nested mutation trap', () => {
    it('throws instead of dropping a nested mutation made without setState', () => {
      const {onSave, strategy} = makeStrategy();

      expect(() => {
        strategy.proxiedState.nested.value = 99;
      }, 'nested state is frozen, so a write that would be lost on restart fails loudly').toThrow(TypeError);
      expect(onSave).not.toHaveBeenCalled();
    });

    it('merges a frozen nested object into a replacement via setState', () => {
      const {strategy} = makeStrategy();

      strategy.setState<TestState>({nested: {...strategy.proxiedState.nested, value: 7}});

      expect(strategy.state, 'reading and spreading frozen nested state still works').toEqual({
        counter: 0,
        nested: {value: 7},
      });
    });

    it('fires onSave for top-level assignments on the proxied state', () => {
      const {onSave, strategy} = makeStrategy();

      strategy.proxiedState.counter = 1;

      expect(onSave).toHaveBeenCalledTimes(1);
      expect(strategy.state).toEqual({counter: 1, nested: {value: 1}});
    });
  });

  describe('restoreState', () => {
    it('restores a state that was written via setState', () => {
      const {strategy} = makeStrategy();
      strategy.setState<TestState>({counter: 7, nested: {value: 3}});
      const persisted = structuredClone(getPersistedState(strategy));

      const restored = new TestStrategy({counter: 0, nested: {value: 1}});
      restored.restoreState(persisted);

      expect(restored.state).toEqual({counter: 7, nested: {value: 3}});
    });

    it('keeps restored keys when setState is called after restoreState', () => {
      const restored = new TestStrategy({counter: 0, nested: {value: 1}});
      restored.restoreState({counter: 7, nested: {value: 3}});

      restored.setState<TestState>({nested: {value: 4}});

      expect(restored.state).toEqual({counter: 7, nested: {value: 4}});
      expect(restored.proxiedState.counter).toBe(7);
    });
  });

  describe('without state', () => {
    class StatelessStrategy extends Strategy {
      static override NAME = 'stateless-strategy';

      protected override async processCandle(): Promise<void> {}
    }

    it('throws when setState is called before any state exists', () => {
      const strategy = new StatelessStrategy();

      expect(() => strategy.setState({counter: 1})).toThrow('No state to update');
    });
  });
});
