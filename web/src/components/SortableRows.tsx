import type { ReactNode } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

/** A vertical list of string keys reordered by each row's grip (touch, mouse or Space + arrows). */
export function SortableRows({
  ids,
  label,
  onMove,
  renderRow,
}: {
  ids: string[];
  label: (id: string) => string;
  onMove: (from: number, to: number) => void;
  renderRow: (id: string) => ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    onMove(ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
          {ids.map((id) => (
            <Row key={id} id={id} label={label(id)}>
              {renderRow(id)}
            </Row>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function Row({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-2 py-2 dark:border-forest-700 dark:bg-forest-800 ${isDragging ? 'relative z-10 shadow-lg' : ''}`}
    >
      <button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Move ${label}`}
        className="shrink-0 cursor-grab touch-none rounded-lg p-1 text-stone-300 hover:text-stone-500 active:cursor-grabbing dark:text-forest-500"
      >
        <GripVertical size={20} />
      </button>
      {children}
    </li>
  );
}
