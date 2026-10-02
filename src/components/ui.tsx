import { useEffect, type ReactNode } from 'react';
import { ClipboardCheck, Package, ShoppingCart, StickyNote, Warehouse, Wrench, X, type LucideIcon } from 'lucide-react';
import type { ListIcon } from '../data/model';

export const LIST_ICONS: Record<ListIcon, LucideIcon> = {
  grocery: ShoppingCart,
  pantry: Package,
  bulk: Warehouse,
  hardware: Wrench,
  notes: StickyNote,
  chores: ClipboardCheck,
};

export function ListIconBadge({ icon, color, size = 'md' }: { icon: ListIcon; color: string; size?: 'sm' | 'md' | 'lg' }) {
  const Icon = LIST_ICONS[icon] ?? ShoppingCart;
  const box = size === 'sm' ? 'h-7 w-7' : size === 'lg' ? 'h-12 w-12' : 'h-9 w-9';
  const glyph = size === 'sm' ? 14 : size === 'lg' ? 24 : 18;
  return (
    <span className={`inline-flex ${box} shrink-0 items-center justify-center rounded-xl text-white`} style={{ backgroundColor: color }}>
      <Icon size={glyph} strokeWidth={2.2} />
    </span>
  );
}

export function Dialog({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`safe-bottom max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl dark:bg-forest-800 ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-stone-100 dark:hover:bg-forest-700" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const inputClass =
  'w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-base outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-200 dark:border-forest-600 dark:bg-forest-900 dark:focus:ring-forest-700';

export const primaryButton =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-forest-700 px-4 py-2.5 font-medium text-white hover:bg-forest-600 disabled:opacity-50 dark:bg-forest-400 dark:text-forest-900 dark:hover:bg-forest-300';

export const ghostButton =
  'inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 font-medium text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-forest-700';

export function Chip({
  active,
  onClick,
  children,
  pressed,
  label,
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
  /** For an on/off chip: its state, announced to assistive technology. */
  pressed?: boolean;
  /** Accessible name when the visible text is not enough ("Remove bread"). */
  label?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={pressed}
      aria-label={label}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-sm whitespace-nowrap transition ${
        active
          ? 'border-forest-700 bg-forest-700 text-white dark:border-forest-300 dark:bg-forest-300 dark:text-forest-900'
          : 'border-stone-200 bg-white text-stone-700 hover:border-forest-400 dark:border-forest-600 dark:bg-forest-800 dark:text-stone-200'
      }`}
    >
      {children}
    </button>
  );
}

/** A small label beside an item, as a menu prints "Vegetarian" or a spice rating: quiet stone text. */
export function Badge({ children, tone = 'stone', label }: { children: ReactNode; tone?: 'stone' | 'forest'; label?: string }) {
  const colour = tone === 'forest' ? 'border-forest-200 text-forest-700 dark:text-forest-300' : 'border-stone-200 text-stone-600 dark:text-stone-300';
  return (
    <li className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs dark:border-forest-600 ${colour}`} aria-label={label}>
      {children}
    </li>
  );
}
