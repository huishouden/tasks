import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { startUpdates } from '@huishouden/pwa-kit/update';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { groceriesRedirect } from './lib/groceriesLink';
import { startI18n } from './i18n';
import './index.css';

// Kitchen, Store and Meals moved to Huishouden Groceries: old links and shortcuts go there.
const moved = groceriesRedirect(window.location.search);
if (moved) window.location.replace(moved);

// New versions install in the background (checked hourly) and apply without reloading the page in
// use (kit ./update).
if (import.meta.env.PROD && !moved) startUpdates({ base: import.meta.env.BASE_URL });

// The language's messages load before the first render, so no English flashes.
if (!moved)
  void startI18n().finally(() =>
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>,
    ),
  );
