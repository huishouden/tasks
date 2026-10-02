import { useEffect, useRef } from 'react';

export const UNDO_TIMEOUT_MS = 6000;

export interface UndoAction {
  id: number;
  message: string;
  undo: () => void;
}

/** Remount with `key={action.id}` so a replacing action gets its own full timeout. */
export function UndoToast({ action, onDismiss }: { action: UndoAction; onDismiss: () => void }) {
  // The parent re-renders often (every snapshot); keeping the latest callback in a ref stops
  // those renders from restarting the timer.
  const dismiss = useRef(onDismiss);
  useEffect(() => {
    dismiss.current = onDismiss;
  });
  useEffect(() => {
    const t = window.setTimeout(() => dismiss.current(), UNDO_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <div className="safe-bottom pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4">
      <div
        role="status"
        className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl bg-forest-800 py-2 pr-2 pl-4 text-white shadow-lg dark:bg-forest-100 dark:text-forest-900"
      >
        <span className="min-w-0 flex-1 truncate">{action.message}</span>
        <button
          onClick={() => {
            action.undo();
            dismiss.current();
          }}
          className="shrink-0 rounded-xl px-3 py-2 font-semibold text-forest-300 hover:bg-white/10 dark:text-forest-700 dark:hover:bg-forest-900/10"
        >
          Undo
        </button>
      </div>
    </div>
  );
}
