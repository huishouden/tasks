import { createContext, useContext, useEffect, useState } from 'react';

/**
 * Where preferences are kept: the signed-out sample household uses its own keys, so trying it
 * never changes the signed-in app's chosen list, mode or "added by" name.
 */
export const PrefScope = createContext('');

/** Per-device preference stored in localStorage; each tablet or phone keeps its own. */
export function usePref<T>(key: string, initial: T): [T, (value: T) => void] {
  const scope = useContext(PrefScope);
  // The app's original name; kept so installed copies keep their settings across the rename.
  const storageKey = `hearthlist.${scope}${key}`;
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(value));
  }, [storageKey, value]);
  return [value, setValue];
}

export type ThemeMode = 'light' | 'dark' | 'auto';

/** Applies the device's theme choice (a `.dark` class on <html>) and says whether it is dark now. */
export function useApplyTheme(mode: ThemeMode): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const isDark = mode === 'dark' || (mode === 'auto' && media.matches);
      document.documentElement.classList.toggle('dark', isDark);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDark ? '#081c15' : '#1b4332');
      setDark(isDark);
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [mode]);
  return dark;
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function useInstallPrompt(): { canInstall: boolean; installed: boolean; install: () => Promise<void> } {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches);
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setEvent(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);
  return {
    canInstall: event !== null,
    installed,
    install: async () => {
      if (!event) return;
      await event.prompt();
      await event.userChoice;
      setEvent(null);
    },
  };
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}
