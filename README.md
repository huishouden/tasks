# HearthList

Shared household groceries, lists and chores. Installable as an app on the kitchen tablet and on phones. Every device sees changes in real time and keeps working offline.

The web app is in `web/`. The Android project in `app/` is the original prototype and is no longer built or deployed.

## Screens

| Lists (tablet) | Kitchen hub (always-on tablet) |
| --- | --- |
| ![Groceries list with aisles, urgency and who added each item](docs/screenshots/lists.png) | ![Kitchen screen with clock, lists, coming-up appointments and the add bar](docs/screenshots/kitchen.png) |
| **Meals** from what was bought | **Tasks** with an appointment and a checklist |
| ![Meal ideas grouped by breakfast, lunch and dinner, with favorites](docs/screenshots/meals.png) | ![Weekend Projects list with a dated appointment and a 7-step checklist](docs/screenshots/tasks-checklist.png) |

<img src="docs/screenshots/store-phone.png" alt="Store mode on a phone, walking Publix with aisle labels" width="260" align="right">

**Store** mode on a phone walks the list in the chosen store's section order, with its aisle labels, and picks the store automatically when you are there.

The screenshots come from a sample household in the emulators. After a change to how the app looks, run `bun run screenshots` in `web/` and commit the updated files in `docs/screenshots/`.

<br clear="right">

## How it works

- **Sign-in:** Google accounts through Firebase Auth. A household is a list of member emails; anyone in it can see and edit every list. Members are added in Settings.
- **Data:** Cloud Firestore, cached on each device so the app opens instantly and works without a connection. Access is enforced by `firestore.rules`.
- **Hosting:** the `huishouden-tasks` site in the shared `huishouden-piekstra` Firebase project, which also hosts the spending app and the household portal. This repo owns the project's Firestore rules; the other apps do not use Firestore.
- **Config:** The app reads its Firebase config from `/__/firebase/init.json`, which Hosting serves, so no project keys are committed.
- **Updates:** every push to `main` runs the checks and deploys. Installed copies pick up a new version on their next launch, and the always-on tablet checks hourly.

Four layouts share the same data: **Lists** for managing everything, **Kitchen** for the always-on tablet (large targets, screen kept awake), **Store** for checking items off aisle by aisle, and **Meals** for meal ideas.

**Meals** asks Gemini (through Firebase AI Logic, on the free Gemini Developer API tier) for breakfast, lunch, dinner and snack ideas built from groceries checked off in the last 10 days. The prompt, response schema and model live in `web/src/data/menus.ts`. Every suggested ingredient is checked in code against what was bought plus a short list of kitchen basics, and meals that use anything else are dropped. Saved ideas are shared with the household. AI Logic only accepts requests carrying an App Check token (reCAPTCHA Enterprise), so the API cannot be used from outside this site.

## Develop

Requires [Bun](https://bun.sh) and Java 21+ (for the Firestore emulator).

```sh
cd web
bun install
bunx firebase emulators:start --only auth,firestore --project demo-hearthlist   # terminal 1
VITE_USE_EMULATORS=true bun run dev                                               # terminal 2
bun run verify   # types, unit tests, security-rules tests, build
bun run e2e      # browser flows against the emulators (starts them itself)
bun run e2e:live # read-only smoke test of the deployed site
bun run e2e:ai   # real Gemini through the app's code (needs an App Check debug token, see below)
bun scripts/menu-probe.ts "eggs, steak, rice"   # try the menu prompt against Gemini and see what the ingredient check drops
```

`e2e:ai` and `menu-probe.ts` read an App Check debug token from `~/.config/hearthlist/appcheck-debug-token`. Register one under App Check → Apps → Tasks → Manage debug tokens, and keep it out of the repo.

CI runs `verify` and `e2e` on every pull request and push, and `e2e:live` right after each deploy.

Against the emulators, the app exposes `window.__testSignIn(email, name)`, which the Playwright suite in `web/e2e` uses to sign in; it does not exist in production builds. `e2e/fixtures.ts` has the shared helpers: emulator reset, sign-in, slow-network emulation and error capture.

## Deploy

`.github/workflows/ci.yml` runs `bun run verify` on every pull request and push. On `main` it then deploys Hosting and the Firestore rules. It authenticates to Google Cloud through Workload Identity Federation, so there is no stored key. It reads three repository variables:

| Variable | Value |
| --- | --- |
| `FIREBASE_PROJECT_ID` | The Firebase project ID |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/<number>/locations/global/workloadIdentityPools/github/providers/household-tasks` |
| `GCP_DEPLOY_SERVICE_ACCOUNT` | `github-deploy@<project>.iam.gserviceaccount.com` |
