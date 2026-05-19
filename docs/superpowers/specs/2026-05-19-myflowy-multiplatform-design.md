# MyFlowy Multiplatform Design

**Date:** 2026-05-19  
**Status:** Approved

## Overview

Refactor the existing vanilla TypeScript / web-components WorkFlowy clone into a yarn-workspaces monorepo with four packages: a shared core library, a React web app, an Electron desktop app, and an Expo mobile app. All platforms authenticate via Google OAuth and persist data as a single JSON file in the user's Google Drive.

---

## Monorepo Structure

```
myflowy/
  packages/
    core/        TypeScript — Task model, Drive sync, offline queue, auth tokens
    web/         React + Vite — browser PWA
    electron/    Electron — thin shell wrapping the web build
    mobile/      Expo — React Native iOS/Android app
  docs/
    GOOGLE_CLOUD_SETUP.md
  package.json   (workspaces root)
```

**Tooling:**
- Yarn workspaces (already in use)
- TypeScript project references across packages
- Vite for web build (replaces Rollup + node-sass — both archived/deprecated)
- Expo managed workflow for mobile
- `electron-builder` for desktop packaging

The existing vanilla TS source is preserved in git history. New packages are built alongside it; old code deleted once parity is verified.

### Supply Chain Hardening

The entire old devDependency tree (rollup, node-sass, tslint, html-minifier) is replaced in this refactor. All 179 vulnerabilities in the current `yarn.lock` live in that tree — none are in the three runtime dependencies — and they disappear with it.

For the new lockfile:

- **`.npmrc`** at the repo root sets `ignore-scripts=true`. Packages that legitimately need postInstall (e.g. `electron` for binary download) are explicitly allowlisted via `config.unsafe-perm` or noted in the implementation plan.
- **Exact version pins** for all auth-related packages in `package.json` (no `^` prefix on `@react-oauth/google` or `@react-native-google-signin/google-signin`). Auth libraries that receive a malicious patch release are high-impact.
- **`yarn --frozen-lockfile`** required in CI — no lockfile drift allowed.
- **[socket.dev](https://socket.dev)** added to the repo for continuous supply chain monitoring (free tier covers open-source projects).

---

## Core Package (`packages/core`)

### Data Model

Unchanged from today:

```typescript
interface Task {
  id: string;
  text: string;
  checked: boolean;
  pinned: boolean;
  collapsed: boolean;
  children: string[];
}
type TaskMap = Record<string, Task>;
```

### Storage Abstraction

`LocalStore` interface with two implementations:

| Implementation | Backend | Used by |
|---|---|---|
| `IDBLocalStore` | IndexedDB | web, Electron |
| `AsyncLocalStore` | `@react-native-async-storage/async-storage` | Expo |

### Drive Sync Layer

- File location: `My Drive/MyFlowy/myflowy.json`
- File shape:
  ```json
  { "version": 1, "tasks": { ...TaskMap }, "updatedAt": "ISO8601" }
  ```
- On open: fetch Drive file; if Drive `updatedAt` is newer than local, merge (Drive wins)
- On every mutation: write to local store immediately, then debounce a Drive upload (500ms)
- Conflict resolution: last-write-wins by `updatedAt` (appropriate for a single-user personal outliner)
- First launch after sign-in: if `myflowy.json` doesn't exist, create it from local task tree

### Offline Queue

- A "pending upload" flag stored in the local store
- On network restore: read full local snapshot, write to Drive
- Whole-file sync — no per-operation log needed at this data scale

### Auth Tokens

- `core` exposes: `getAccessToken()`, `setAccessToken(token)`, `clearAccessToken()`
- Each platform owns its OAuth flow and hands the token to core
- Token storage is platform-specific (see per-platform sections)

---

## Web App (`packages/web`)

**Stack:** React, Vite, TypeScript

### Auth

- Google Identity Services (GIS) popup flow
- On success: `core.setAccessToken(token)`, trigger initial Drive sync
- Access token persisted in `localStorage`; GIS handles silent refresh on expiry
- Signed-out state renders only a login screen

### UI Structure

```
<App>
  <AuthGate>       sign-in screen when no token
  <TaskTree>       recursive tree (replaces x-task web component)
  <Controls>       mobile keyboard controls bar
  <Sidebar>        shortcuts, about info
```

- State management: no external store library; `LocalStore` from core is source of truth; mutations go through core, re-renders triggered via a simple event emitter
- Sidebar no longer has manual URL/API-key form — Google Drive replaces the old custom sync backend

### PWA

`vite-plugin-pwa` replaces the hand-rolled service worker.

### Electron Reuse

The Vite `dist/` output is loaded directly by Electron — no separate build step.

---

## Electron App (`packages/electron`)

### Files

```
electron/
  main.ts      creates BrowserWindow, local auth HTTP server, IPC handlers
  preload.ts   injects narrow window.electronBridge into renderer
  package.json
```

### How It Works

- `main.ts` opens a `BrowserWindow` loading `packages/web/dist/index.html`
- Renderer detects `window.electronBridge` and switches to Electron OAuth flow

### OAuth Flow

1. Renderer sends IPC message `"start-auth"`
2. Main process opens a second `BrowserWindow` pointing to Google's OAuth URL
3. Google redirects to `http://127.0.0.1:<PORT>`
4. Main process runs a local HTTP server on that port, catches the redirect, extracts the token
5. Sends token back to renderer via IPC
6. Renderer calls `core.setAccessToken(token)`

Redirect URI registered in Google Cloud: `http://127.0.0.1` (loopback — Google permits this for desktop apps).

### Token Storage

Refresh token stored via Electron's `safeStorage` (OS keychain). Exchanged for access token on startup.

### Packaging

`electron-builder` — `.dmg` (macOS), `.exe` (Windows), `.AppImage` (Linux).

---

## Mobile App (`packages/mobile`)

**Stack:** Expo (managed), React Native, TypeScript

### Auth

- `@react-native-google-signin/google-signin` — Expo's current recommended library for Google auth on mobile; wraps Google's native SDK directly rather than a generic browser flow (`expo-auth-session` is a generic fallback; Google-specific native SDK is preferred per Expo docs)
- On success: `core.setAccessToken(token)`
- Refresh token stored in `expo-secure-store`; exchanged for access token on startup
- Requires separate OAuth client IDs for iOS and Android (see Google Cloud setup doc)

### UI Structure

```
<App>
  <AuthGate>          login screen when no token
  <TaskTree>          recursive RN View/Text/TouchableOpacity tree
  <BottomControls>    indent/outdent/move buttons
```

Same interaction model as web (add, indent, reorder) implemented with RN `TextInput` and gesture handlers.

### Local Storage

`AsyncLocalStore` wraps `@react-native-async-storage/async-storage` — same `LocalStore` interface as `IDBLocalStore`, so all core Drive sync logic is reused unchanged.

### Offline

`expo-network` detects connectivity changes and triggers the offline queue flush from core.

### Builds

`eas build` for iOS and Android — no local Xcode/Android Studio required for CI builds.

---

## Google Drive + Auth Design

### OAuth Scopes

```
openid
email
profile
https://www.googleapis.com/auth/drive.file
```

`drive.file` gives access only to files the app itself created — the user's other Drive content is never accessible.

### OAuth Client IDs (one per platform)

| Platform | Client type in Google Cloud | Redirect URI |
|---|---|---|
| Web | Web application | `http://localhost:5173` (dev), `https://yourdomain.com` (prod) |
| Electron | Web application (desktop loopback) | `http://127.0.0.1` |
| iOS | iOS | Bundle ID: `com.yourname.myflowy` |
| Android | Android | Package name + SHA-1 certificate fingerprint |

### Token Lifecycle

| Platform | Access token | Refresh token |
|---|---|---|
| Web | GIS silent refresh | Managed by GIS |
| Electron | Exchanged from refresh token on startup | `safeStorage` (OS keychain) |
| Mobile | Managed by `@react-native-google-signin/google-signin` native SDK | `expo-secure-store` |

### Auth Package Safety

Two packages with similar names exist on npm — use only the scoped, correct ones:

| Use | Avoid |
|---|---|
| `@react-oauth/google` (web) | `react-oauth-google`, `react-google-oauth` |
| `@react-native-google-signin/google-signin` (mobile) | `react-native-google-signin` (old unscoped fork) |

Both correct packages are pinned to exact versions (no `^`) in their respective `package.json` files.

---

## Google Cloud Setup Doc

Delivered as `docs/GOOGLE_CLOUD_SETUP.md`. Covers:

1. Creating a Google Cloud project
2. Enabling the Google Drive API
3. Configuring the OAuth consent screen (app name, scopes, test users)
4. Creating the four OAuth 2.0 client IDs (web, Electron/desktop, iOS, Android)
5. Where each client ID / client secret goes in the codebase (env vars, `app.json`)
6. Publishing the app and moving from test to production consent screen

---

## Out of Scope

- Multi-user or shared lists
- Real-time collaboration / CRDTs
- The old custom REST API sync backend (removed)
- Automatic conflict resolution beyond last-write-wins
