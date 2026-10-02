import { Plus } from 'lucide-react';
import type { ListItem, Staple } from '../data/model';

interface Props {
  staples: Staple[];
  activeItems: ListItem[];
  onAdd: (staple: Staple) => void;
  limit?: number;
  large?: boolean;
}

/** Things the household adds most often, minus anything already on the list. */
export function topStaples(staples: Staple[], activeItems: ListItem[], limit: number): Staple[] {
  const onList = new Set(activeItems.filter((i) => !i.completed).map((i) => i.name.trim().toLowerCase()));
  return staples
    .filter((s) => s.displayName && (s.timesAdded ?? 0) >= 2 && !onList.has(s.displayName.toLowerCase()))
    .sort((a, b) => b.timesAdded - a.timesAdded || b.lastAddedAt - a.lastAddedAt)
    .slice(0, limit);
}

export function StaplesShelf({ staples, activeItems, onAdd, limit = 12, large }: Props) {
  const shown = topStaples(staples, activeItems, limit);
  if (shown.length === 0) return null;
  return (
    <section aria-label="Frequent items">
      <h3 className="mb-2 text-xs font-semibold tracking-wider text-stone-500 uppercase dark:text-stone-400">Running low? Tap to add</h3>
      <div className={`flex gap-2 ${large ? 'flex-wrap' : 'scrollbar-none overflow-x-auto pb-1'}`}>
        {shown.map((s) => (
          <button
            key={s.id}
            onClick={() => onAdd(s)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border border-forest-200 bg-forest-50 font-medium text-forest-700 hover:bg-forest-100 dark:border-forest-600 dark:bg-forest-800 dark:text-forest-100 ${
              large ? 'px-4 py-2.5 text-lg' : 'px-3 py-1.5 text-sm'
            }`}
          >
            <Plus size={large ? 18 : 14} strokeWidth={2.5} />
            {s.displayName}
          </button>
        ))}
      </div>
    </section>
  );
}
