import { Component, type ReactNode } from 'react';

/** Last resort for a rendering crash: a reload screen instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="grid max-w-sm justify-items-center gap-3 text-center">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="text-stone-600 dark:text-stone-300">Your lists are safe. Reloading usually fixes this.</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-xl bg-forest-700 px-4 py-2.5 font-medium text-white dark:bg-forest-400 dark:text-forest-900"
          >
            Reload
          </button>
          <p className="font-mono text-xs break-all text-stone-400">{this.state.error.message}</p>
        </div>
      </div>
    );
  }
}
