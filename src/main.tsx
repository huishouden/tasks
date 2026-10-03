import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { groceriesRedirect } from './lib/groceriesLink';
import './index.css';

// Kitchen, Store and Meals moved to Huishouden Groceries: old links and shortcuts go there.
const moved = groceriesRedirect(window.location.search);
if (moved) window.location.replace(moved);

// Checks for a new deploy hourly so installed copies pick up updates without anyone reinstalling;
// autoUpdate reloads the page once the new worker activates.
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (registration) setInterval(() => void registration.update(), 60 * 60 * 1000);
  },
});

if (!moved) createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
