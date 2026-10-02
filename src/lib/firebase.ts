import { initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { firebaseConfigFromEnv } from '@huishouden/pwa-kit/firebase';
import { ReCaptchaEnterpriseProvider, initializeAppCheck } from 'firebase/app-check';
import { GoogleAuthProvider, connectAuthEmulator, getAuth, signInWithCredential, type Auth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';

export interface FirebaseHandles {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

export const useEmulators = import.meta.env.VITE_USE_EMULATORS === 'true';

/** The "Tasks" web app in huishouden-piekstra. Public, like the rest of the web config. */
const APP_ID = '1:865471112898:web:88de281c1be2181a4afd5b';

/** reCAPTCHA Enterprise site key for App Check on huishouden-tasks.web.app. Site keys are public. */
const APP_CHECK_SITE_KEY = '6LeCC9otAAAAAN4XiBDSnvtKapMGWRarZoUjRGzM'; // gitleaks:allow (public site key, sent to every visitor)

async function loadConfig(): Promise<FirebaseOptions> {
  if (useEmulators) {
    return { apiKey: 'demo-key', projectId: 'demo-huishouden-tasks', authDomain: 'localhost', appId: 'demo-app' };
  }
  // CI builds get the web config from the repo's VITE_FIREBASE_* variables (public by design).
  if (import.meta.env.VITE_FIREBASE_API_KEY) return firebaseConfigFromEnv(import.meta.env);
  // Builds without them (local previews) read what Firebase Hosting serves.
  const res = await fetch('/__/firebase/init.json');
  if (!res.ok) throw new Error(`Firebase config unavailable (${res.status}). Is the app served from Firebase Hosting?`);
  // Sign-in keeps the project's default authDomain (*.firebaseapp.com): it is the only redirect
  // URI Google's auto-created OAuth client allows, and the popup flow works across origins.
  const config = (await res.json()) as FirebaseOptions;
  // Hosting omits appId unless the site is linked to an app; App Check and AI Logic require it.
  config.appId ??= APP_ID;
  return config;
}

let handles: Promise<FirebaseHandles> | null = null;

export function getFirebase(): Promise<FirebaseHandles> {
  handles ??= loadConfig().then((config) => {
    const app = initializeApp(config);
    if (!useEmulators) {
      // Proves requests come from this site; Gemini (AI Logic) rejects calls without it.
      initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(APP_CHECK_SITE_KEY), isTokenAutoRefreshEnabled: true });
    }
    const auth = getAuth(app);
    const db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
    if (useEmulators) {
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      connectFirestoreEmulator(db, '127.0.0.1', 8080);
      // Browser tests sign in with an emulator-only Google credential instead of driving the popup.
      Object.assign(window, {
        __testSignIn: (email: string, name: string) =>
          signInWithCredential(
            auth,
            GoogleAuthProvider.credential(JSON.stringify({ sub: email, email, email_verified: true, name })),
          ),
      });
    }
    return { app, auth, db };
  });
  return handles;
}
