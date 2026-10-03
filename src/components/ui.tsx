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
// app's .dark class; Tasks keeps only its own list badge.
export { Chip, Dialog, ghostButton, inputClass, primaryButton } from '@huishouden/pwa-kit/react/ui';
