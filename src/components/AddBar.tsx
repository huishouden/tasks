import { useMemo, useRef, useState } from 'react';
import { ChevronDown, Plus, Zap } from 'lucide-react';
import {
  ALL_CATEGORIES,
  ALL_URGENCIES,
  CATEGORIES,
  URGENCY,
  isTaskList,
  matchSuggestions,
  type Category,
  type ListIcon,
  type Staple,
  type Urgency,
} from '../data/model';
import { inputClass } from './ui';
import { closeEnough, guessCategory } from '../data/categorize';

export interface AddRequest {
  name: string;
  quantity: string;
  notes: string;
  category: Category;
  urgency: Urgency;
}

interface Props {
  staples: Staple[];
  onAdd: (req: AddRequest) => void;
  large?: boolean;
  placeholder?: string;
  /** The list's kind, so the aisle shown in the details matches what will be saved. */
  listIcon?: ListIcon;
}

export function AddBar({ staples, onAdd, large, placeholder, listIcon }: Props) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const [urgency, setUrgency] = useState<Urgency>(URGENCY.NORMAL);
  const [showDetails, setShowDetails] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => {
    const exact = matchSuggestions(staples, name);
    // Nothing spelled that way: offer close spellings ("zuchini" → "Zucchini").
    const found = exact.length > 0 ? exact : staples.filter((st) => closeEnough(name, st.displayName)).slice(0, 6);
    return found.filter((st) => st.displayName.toLowerCase() !== name.trim().toLowerCase());
  }, [staples, name]);
  const task = isTaskList(listIcon);
  const effectiveCategory = category ?? (name.trim() ? guessCategory(name, listIcon) : CATEGORIES.OTHER);

  function reset() {
    setName('');
    setQuantity('');
    setNotes('');
    setCategory(null);
    setUrgency(URGENCY.NORMAL);
    inputRef.current?.focus();
  }

  function submit(chosen?: Staple) {
    // Typing an existing staple in different case reuses its saved spelling and aisle.
    const override = chosen ?? staples.find((s) => s.displayName.toLowerCase() === name.trim().toLowerCase());
    const finalName = override?.displayName ?? name;
    if (!finalName.trim()) return;
    onAdd({
      name: finalName,
      quantity: quantity || override?.defaultQuantity || '1',
      notes,
      category: override?.category ?? effectiveCategory,
      urgency,
    });
    reset();
  }

  return (
    <div className="relative">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className={`flex items-center gap-2 rounded-2xl border border-stone-200 bg-white p-1.5 shadow-sm focus-within:border-forest-500 dark:border-forest-600 dark:bg-forest-800 ${large ? 'p-2' : ''}`}
      >
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={() => setFocused(true)}
          // Delayed so a tap on a suggestion lands first; skipped if focus already came back
          // (adding an item refocuses the input right after the Add button took focus).
          onBlur={() => setTimeout(() => setFocused(document.activeElement === inputRef.current), 150)}
          placeholder={placeholder ?? (task ? 'Add a task: drop off dry cleaning before 6…' : 'Add an item: milk, light bulbs, call plumber…')}
          enterKeyHint="done"
          autoComplete="off"
          className={`min-w-0 flex-1 bg-transparent px-3 outline-none ${large ? 'py-3 text-xl' : 'py-2 text-base'}`}
          aria-label="New item"
        />
        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          className={`rounded-xl p-2 text-stone-500 hover:bg-stone-100 dark:hover:bg-forest-700 ${showDetails ? 'bg-stone-100 dark:bg-forest-700' : ''}`}
          aria-label="More details"
          aria-expanded={showDetails}
        >
          <ChevronDown size={20} className={showDetails ? 'rotate-180 transition' : 'transition'} />
        </button>
        <button
          type="submit"
          disabled={!name.trim()}
          className={`inline-flex items-center gap-1.5 rounded-xl bg-forest-700 font-semibold text-white disabled:opacity-40 dark:bg-forest-400 dark:text-forest-900 ${large ? 'px-6 py-3 text-lg' : 'px-4 py-2'}`}
        >
          <Plus size={large ? 22 : 18} strokeWidth={2.5} /> Add
        </button>
      </form>

      {focused && suggestions.length > 0 && (
        <ul className="absolute right-0 left-0 z-20 mt-1 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-lg dark:border-forest-600 dark:bg-forest-800">
          {suggestions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => submit(s)}
                className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-forest-50 dark:hover:bg-forest-700"
              >
                <span>
                  <span className="font-medium">{s.displayName}</span>
                  <span className="ml-2 text-sm text-stone-500">{s.category}</span>
                </span>
                <span className="text-sm text-stone-400">added {s.timesAdded}×</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {showDetails && (
        <div className="mt-2 grid gap-2 rounded-2xl border border-stone-200 bg-white p-3 sm:grid-cols-2 dark:border-forest-600 dark:bg-forest-800">
          {!task && (
            <label className="text-sm text-stone-500">
              Quantity
              <input value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="1, 2 lbs, a dozen" className={`${inputClass} mt-1`} />
            </label>
          )}
          <label className="text-sm text-stone-500">
            Notes
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={task ? 'Ticket number, what to bring…' : 'Brand, size, organic…'} className={`${inputClass} mt-1`} />
          </label>
          {!task && (
            <label className="text-sm text-stone-500">
              Section
              <select value={effectiveCategory} onChange={(e) => setCategory(e.target.value as Category)} className={`${inputClass} mt-1`}>
                {ALL_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          )}
          <div className="text-sm text-stone-500">
            When
            <div className="mt-1 flex gap-1.5">
              {ALL_URGENCIES.map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUrgency(u)}
                  className={`flex-1 rounded-xl border px-2 py-2.5 text-sm ${
                    urgency === u
                      ? u === URGENCY.URGENT
                        ? 'border-terracotta bg-terracotta-light font-semibold text-terracotta'
                        : 'border-forest-600 bg-forest-50 font-semibold text-forest-700 dark:bg-forest-700 dark:text-forest-100'
                      : 'border-stone-200 dark:border-forest-600'
                  }`}
                >
                  {u === URGENCY.URGENT && <Zap size={12} className="mr-0.5 inline" />}
                  {u}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
