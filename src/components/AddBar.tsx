import { useRef, useState } from 'react';
import { ChevronDown, Plus, Zap } from 'lucide-react';
import { ALL_URGENCIES, URGENCY, urgencyLabel, type Urgency } from '../data/model';
import { useT } from '../i18n';
import { inputClass } from './ui';

export interface AddRequest {
  name: string;
  notes: string;
  urgency: Urgency;
}

interface Props {
  onAdd: (req: AddRequest) => void;
  placeholder?: string;
}

export function AddBar({ onAdd, placeholder }: Props) {
  const t = useT();
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [urgency, setUrgency] = useState<Urgency>(URGENCY.NORMAL);
  const [showDetails, setShowDetails] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function submit() {
    if (!name.trim()) return;
    onAdd({ name, notes, urgency });
    setName('');
    setNotes('');
    setUrgency(URGENCY.NORMAL);
    inputRef.current?.focus();
  }

  return (
    <div className="relative">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className={`flex items-center gap-2 rounded-2xl border border-line bg-surface p-1.5 shadow-sm focus-within:border-forest-500`}
      >
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={placeholder ?? t('add.placeholder')}
          enterKeyHint="done"
          autoComplete="off"
          className={`min-w-0 flex-1 bg-transparent px-3 outline-none py-2 text-base`}
          aria-label={t('add.newItem')}
        />
        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          className={`rounded-xl p-2 text-muted hover:bg-stone-100 dark:hover:bg-forest-700 ${showDetails ? 'bg-stone-100 dark:bg-forest-700' : ''}`}
          aria-label={t('add.moreDetails')}
          aria-expanded={showDetails}
        >
          <ChevronDown size={20} className={showDetails ? 'rotate-180 transition' : 'transition'} />
        </button>
        <button
          type="submit"
          disabled={!name.trim()}
          className={`inline-flex items-center gap-1.5 rounded-xl bg-primary font-semibold text-on-primary disabled:opacity-40 px-4 py-2`}
        >
          <Plus size={18} strokeWidth={2.5} /> {t('common.add')}
        </button>
      </form>

      {showDetails && (
        <div className="mt-2 grid gap-2 rounded-2xl border border-line bg-surface p-3 sm:grid-cols-2">
          <label className="text-sm text-muted">
            {t('common.notes')}
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('add.notesPlaceholder')} className={`${inputClass} mt-1`} />
          </label>
          <div className="text-sm text-muted">
            {t('item.when')}
            <div className="mt-1 flex gap-1.5">
              {ALL_URGENCIES.map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUrgency(u)}
                  className={`flex-1 rounded-xl border px-2 py-2.5 text-sm ${
                    urgency === u
                      ? u === URGENCY.URGENT
                        ? 'border-terracotta bg-attention-tint font-semibold text-attention'
                        : 'border-forest-600 bg-tint font-semibold text-forest-700 dark:text-forest-100'
                      : 'border-line'
                  }`}
                >
                  {u === URGENCY.URGENT && <Zap size={12} className="mr-0.5 inline" />}
                  {urgencyLabel(u)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
