import {useState, useEffect} from 'react';

type TriggerType = 'pct' | 'nominal' | 'price';
type OrderType = 'limit' | 'market';

interface GuardForm {
  enabled: boolean;
  triggerType: TriggerType;
  value: string;
  orderType: OrderType;
}

const emptyGuard = (): GuardForm => ({
  enabled: false,
  triggerType: 'pct',
  value: '',
  orderType: 'limit',
});

function toTriggerType(value: string): TriggerType {
  return value === 'nominal' || value === 'price' ? value : 'pct';
}

function toOrderType(value: string): OrderType {
  return value === 'market' ? 'market' : 'limit';
}

function parseGuard(
  protectedConfig: Record<string, unknown> | undefined,
  prefix: 'stopLoss' | 'takeProfit'
): GuardForm {
  if (!protectedConfig) {
    return emptyGuard();
  }
  const pct = protectedConfig[`${prefix}Pct`];
  const nominal = protectedConfig[`${prefix}Nominal`];
  const price = protectedConfig[`${prefix}Price`];
  const order = protectedConfig[`${prefix}Order`];
  const orderType: OrderType = typeof order === 'string' ? toOrderType(order) : 'limit';

  if (typeof pct === 'string') {
    return {enabled: true, triggerType: 'pct', value: pct, orderType};
  }
  if (typeof nominal === 'string') {
    return {enabled: true, triggerType: 'nominal', value: nominal, orderType};
  }
  if (typeof price === 'string') {
    return {enabled: true, triggerType: 'price', value: price, orderType};
  }
  return emptyGuard();
}

function buildProtectedConfig(
  stopLoss: GuardForm,
  takeProfit: GuardForm
): Record<string, unknown> | undefined {
  const result: Record<string, unknown> = {};

  if (stopLoss.enabled && stopLoss.value.trim()) {
    const value = stopLoss.value.trim();
    if (stopLoss.triggerType === 'pct') result.stopLossPct = value;
    if (stopLoss.triggerType === 'nominal') result.stopLossNominal = value;
    if (stopLoss.triggerType === 'price') result.stopLossPrice = value;
    result.stopLossOrder = stopLoss.orderType;
  }

  if (takeProfit.enabled && takeProfit.value.trim()) {
    const value = takeProfit.value.trim();
    if (takeProfit.triggerType === 'pct') result.takeProfitPct = value;
    if (takeProfit.triggerType === 'nominal') result.takeProfitNominal = value;
    if (takeProfit.triggerType === 'price') result.takeProfitPrice = value;
    result.takeProfitOrder = takeProfit.orderType;
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

interface ProtectionModalProps {
  open: boolean;
  initialProtected: Record<string, unknown> | undefined;
  onSave: (protectedConfig: Record<string, unknown> | undefined) => void;
  onClose: () => void;
}

export function ProtectionModal({open, initialProtected, onSave, onClose}: ProtectionModalProps) {
  const [stopLoss, setStopLoss] = useState<GuardForm>(emptyGuard);
  const [takeProfit, setTakeProfit] = useState<GuardForm>(emptyGuard);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (initialProtected) {
      setStopLoss(parseGuard(initialProtected, 'stopLoss'));
      setTakeProfit(parseGuard(initialProtected, 'takeProfit'));
    } else {
      // Fresh open with no existing protection: pre-enable stop-loss so the
      // form is visible immediately. User just has to type a value and Save.
      setStopLoss({enabled: true, triggerType: 'pct', value: '', orderType: 'limit'});
      setTakeProfit(emptyGuard());
    }
  }, [open, initialProtected]);

  if (!open) {
    return null;
  }

  const builtConfig = buildProtectedConfig(stopLoss, takeProfit);
  const hasIncompleteGuard =
    (stopLoss.enabled && !stopLoss.value.trim()) || (takeProfit.enabled && !takeProfit.value.trim());
  const canSave = builtConfig !== undefined;
  const hint = hasIncompleteGuard
    ? 'Enter a value for each enabled guard to save.'
    : !stopLoss.enabled && !takeProfit.enabled
      ? 'Enable stop-loss or take-profit to add protection.'
      : null;

  const handleSave = () => {
    if (!canSave) {
      return;
    }
    onSave(builtConfig);
    onClose();
  };

  const handleRemove = () => {
    onSave(undefined);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={onClose}>
      <div
        className="bg-slate-800 border border-slate-700 rounded-lg p-6 w-full max-w-md shadow-xl"
        onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-white mb-2">Protection settings</h3>
        <p className="text-xs text-slate-400 mb-4">
          Stop-loss and take-profit kill switches run on top of the selected strategy. Enable either or
          both to have the backtester exit automatically when thresholds are reached. Once a guard fires,
          the strategy is terminal for the session.
        </p>

        <GuardSection title="Stop-loss" suffix="loss" guard={stopLoss} onChange={setStopLoss} />
        <div className="h-3" />
        <GuardSection title="Take-profit" suffix="gain" guard={takeProfit} onChange={setTakeProfit} />

        {hint && <p className="text-xs text-amber-400 mt-3">{hint}</p>}

        <div className="flex gap-2 mt-6">
          <button
            onClick={handleRemove}
            className="flex-1 py-2 px-3 bg-slate-700 hover:bg-slate-600 text-white rounded-md text-sm cursor-pointer transition-colors">
            Remove
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2 px-3 bg-slate-700 hover:bg-slate-600 text-white rounded-md text-sm cursor-pointer transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className={`flex-1 py-2 px-3 rounded-md text-sm transition-colors ${
              canSave
                ? 'bg-purple-600 hover:bg-purple-700 text-white cursor-pointer'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
            }`}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

interface GuardSectionProps {
  title: string;
  suffix: 'loss' | 'gain';
  guard: GuardForm;
  onChange: (guard: GuardForm) => void;
}

function GuardSection({title, suffix, guard, onChange}: GuardSectionProps) {
  const update = (patch: Partial<GuardForm>) => onChange({...guard, ...patch});

  const valueLabel =
    guard.triggerType === 'pct'
      ? `Percent ${suffix === 'loss' ? 'drop' : 'gain'} from avg entry`
      : guard.triggerType === 'nominal'
        ? `Counter-currency ${suffix}`
        : 'Absolute price target';

  const valuePlaceholder =
    guard.triggerType === 'pct' ? '5' : guard.triggerType === 'nominal' ? '10' : suffix === 'loss' ? '95' : '110';

  return (
    <div className="bg-slate-900/50 border border-slate-700 rounded-md p-3">
      <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
        <input
          type="checkbox"
          checked={guard.enabled}
          onChange={e => update({enabled: e.target.checked})}
          className="accent-purple-500 w-4 h-4"
        />
        <span className="font-semibold">{title}</span>
      </label>

      {guard.enabled && (
        <div className="mt-3 space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Trigger type</label>
            <select
              value={guard.triggerType}
              onChange={e => update({triggerType: toTriggerType(e.target.value)})}
              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-purple-500">
              <option value="pct">Percentage</option>
              <option value="nominal">Nominal (counter currency)</option>
              <option value="price">Absolute price</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">{valueLabel}</label>
            <input
              type="text"
              value={guard.value}
              onChange={e => update({value: e.target.value})}
              placeholder={valuePlaceholder}
              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Order type</label>
            <select
              value={guard.orderType}
              onChange={e => update({orderType: toOrderType(e.target.value)})}
              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-purple-500">
              <option value="limit">Limit (exact target, may not fill on gap)</option>
              <option value="market">Market (guaranteed fill, slippage possible)</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
