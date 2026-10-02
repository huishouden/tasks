import { useState } from 'react';
import { Signpost, X } from 'lucide-react';

/**
 * Asks where the item just checked off was, from a bar pinned to the bottom of the screen, so it
 * stays in view while the item moves into Done. Optional: Skip, or just keep shopping.
 */
export function AislePrompt({ itemName, storeName, onSave, onSkip }: { itemName: string; storeName: string; onSave: (aisle: string) => void; onSkip: () => void }) {
  const [value, setValue] = useState('');
  return (
    <div className="safe-bottom fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pt-2">
      <form
        role="region"
        aria-label={`Aisle for ${itemName} at ${storeName}`}
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) onSave(value);
        }}
        className="flex w-full max-w-md items-center gap-2 rounded-2xl border border-stone-200 bg-white px-3 py-2 shadow-lg dark:border-forest-600 dark:bg-forest-800"
      >
        <Signpost size={18} className="shrink-0 text-forest-600" />
        <span className="min-w-0 flex-1 text-sm leading-tight [overflow-wrap:anywhere]">
          <strong>{itemName}</strong>: which aisle?
        </span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. 12"
          aria-label={`Aisle for ${itemName}`}
          enterKeyHint="done"
          maxLength={24}
          className="w-20 shrink-0 rounded-xl border border-stone-200 bg-white px-2 py-1 text-sm outline-none focus:border-forest-500 dark:border-forest-600 dark:bg-forest-900"
        />
        <button type="submit" disabled={!value.trim()} className="shrink-0 rounded-xl bg-forest-700 px-2.5 py-1 text-sm font-semibold text-white disabled:opacity-40 dark:bg-forest-400 dark:text-forest-900">
          Save
        </button>
        <button type="button" onClick={onSkip} className="shrink-0 rounded-xl p-1 text-stone-400 hover:text-stone-600" aria-label="Skip aisle">
          <X size={18} />
        </button>
      </form>
    </div>
  );
}
