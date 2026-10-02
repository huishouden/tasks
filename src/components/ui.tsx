import type { ReactNode } from 'react';
import { ClipboardCheck, Package, ShoppingCart, StickyNote, Warehouse, Wrench, type LucideIcon } from 'lucide-react';
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

// The suite's dialog, chips, buttons and inputs (DESIGN.md "Components"), with dark styles under the
// app's .dark class; Tasks keeps only its own list badge and the small rating badge.
export { Chip, Dialog, ghostButton, inputClass, primaryButton } from '@huishouden/pwa-kit/react/ui';

/** A small label beside an item, as a menu prints "Vegetarian" or a spice rating: quiet stone text. */
export function Badge({ children, tone = 'stone', label }: { children: ReactNode; tone?: 'stone' | 'forest'; label?: string }) {
  const colour = tone === 'forest' ? 'border-forest-200 text-forest-700 dark:text-forest-300' : 'border-stone-200 text-stone-600 dark:text-stone-300';
  return (
    <li className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs dark:border-forest-600 ${colour}`} aria-label={label}>
      {children}
    </li>
  );
}
