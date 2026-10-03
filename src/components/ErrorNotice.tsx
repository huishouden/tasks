import { useState } from 'react';
import { AlertTriangle, RotateCw, WifiOff } from 'lucide-react';
import type { FriendlyError } from '../lib/errors';

/** A plain-language error with an optional retry and the technical text tucked behind "Details". */
export function ErrorNotice({ error, onRetry, retrying }: { error: FriendlyError; onRetry?: () => void; retrying?: boolean }) {
  const [open, setOpen] = useState(false);
  const Icon = error.kind === 'offline' ? WifiOff : AlertTriangle;
  return (
    <div role="alert" className="rounded-2xl border border-terracotta/40 bg-terracotta-light/60 p-3 text-sm text-ink dark:bg-terracotta/20">
      <div className="flex items-start gap-2">
        <Icon size={18} className="mt-0.5 shrink-0 text-terracotta" />
        <p className="flex-1 font-medium">{error.message}</p>
        {onRetry && error.retryable && (
          <button
            onClick={onRetry}
            disabled={retrying}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-surface px-2.5 py-1 font-semibold text-attention hover:bg-sunken disabled:opacity-50"
          >
            <RotateCw size={14} className={retrying ? 'animate-spin' : ''} /> Try again
          </button>
        )}
      </div>
      {error.detail && (
        <button onClick={() => setOpen((v) => !v)} className="mt-1 ml-6 text-xs text-muted underline">
          {open ? 'Hide details' : 'Details'}
        </button>
      )}
      {open && <p className="mt-1 ml-6 font-mono text-xs break-all text-muted">{error.detail}</p>}
    </div>
  );
}
