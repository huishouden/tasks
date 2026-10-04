import { Component, type ReactNode } from 'react';
import { t } from '../i18n';

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
          <h1 className="text-xl font-semibold">{t('crash.title')}</h1>
          <p className="text-muted">{t('crash.body')}</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-xl bg-primary px-4 py-2.5 font-medium text-on-primary"
          >
            {t('crash.reload')}
          </button>
          <p className="font-mono text-xs break-all text-muted">{this.state.error.message}</p>
        </div>
      </div>
    );
  }
}
