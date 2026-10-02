import type { ReactNode } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import type { ListItem } from '../data/model';
import type { DragProps } from './ItemRow';

interface Props {
  items: ListItem[];
  onMove: (from: number, to: number) => void;
  renderItem: (item: ListItem, drag?: DragProps) => ReactNode;
  disabled?: boolean;
}

/** Vertical list reordered by dragging each row's grip; touch, mouse and keyboard all work. */
export function SortableItems({ items, onMove, renderItem, disabled }: Props) {
  const sensors = useSensors(
    // A short distance threshold so a tap on the grip is not mistaken for a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.id === active.id);
    const to = items.findIndex((i) => i.id === over.id);
    if (from >= 0 && to >= 0) onMove(from, to);
  }
  if (disabled) return <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">{items.map((item) => renderItem(item))}</ul>;
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
          {items.map((item) => (
            <SortableRow key={item.id} item={item} renderItem={renderItem} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({ item, renderItem }: { item: ListItem; renderItem: Props['renderItem'] }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const handle = (
    <button
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`Move ${item.name}`}
      className="-ml-1 shrink-0 cursor-grab touch-none rounded-lg p-1 text-stone-300 hover:text-stone-500 active:cursor-grabbing dark:text-forest-500"
    >
      <GripVertical size={20} />
    </button>
  );
  return renderItem(item, {
    handle,
    rowRef: setNodeRef,
    rowStyle: { transform: CSS.Translate.toString(transform), transition },
    dragging: isDragging,
  });
}
