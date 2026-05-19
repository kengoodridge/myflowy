# MyFlowy Phase 1 — Monorepo + Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the repo to a yarn-workspaces monorepo with supply-chain hardening, then build and fully test the `@myflowy/core` package — the shared library all platforms depend on.

**Architecture:** `@myflowy/core` owns the `Task` data model, a `LocalStore` abstraction (IndexedDB implementation included; mobile's AsyncStorage implementation lives in `packages/mobile`), a Drive REST API layer, a `DriveSync` class, and a `SyncEngine` that orchestrates local-first writes with debounced Drive uploads and offline queue recovery. Auth tokens are stored in a simple in-memory singleton; each platform sets the token after its own OAuth flow.

**Tech Stack:** TypeScript 5, yarn workspaces, vitest 2, idb-keyval 6, fake-indexeddb 5, Google Drive REST API v3.

**Spec:** `docs/superpowers/specs/2026-05-19-myflowy-multiplatform-design.md`

**Series:** This is Plan 1 of 4.
- Plan 2: Web app (React + Vite + GIS OAuth + PWA)
- Plan 3: Electron (shell + loopback OAuth + electron-builder)
- Plan 4: Mobile (Expo + @react-native-google-signin + EAS) + GOOGLE_CLOUD_SETUP.md

---

## File Map

```
[root]
  package.json            ← replace with workspaces root
  .npmrc                  ← ignore-scripts + allowlist
  tsconfig.base.json      ← shared TS config

packages/core/
  package.json
  tsconfig.json
  vitest.config.ts
  src/
    index.ts              ← barrel export
    types.ts              ← Task, TaskMap, LocalStore, DriveFile
    utils.ts              ← uuid(), initialRoot()
    auth.ts               ← getAccessToken / setAccessToken / clearAccessToken
    store/
      IDBLocalStore.ts    ← IndexedDB implementation of LocalStore
    drive/
      driveApi.ts         ← raw Drive REST API fetch wrappers
      DriveSync.ts        ← folder + file management
    SyncEngine.ts         ← orchestrates store + drive + offline queue
    __tests__/
      auth.test.ts
      utils.test.ts
      IDBLocalStore.test.ts
      DriveSync.test.ts
      SyncEngine.test.ts
```

---

## Task 1: Convert root to yarn workspaces monorepo

**Files:**
- Modify: `package.json`
- Create: `.npmrc`
- Create: `tsconfig.base.json`
- Create: `packages/` directory

- [ ] **Step 1: Scaffold packages directory**

```bash
mkdir -p packages/core packages/web packages/electron packages/mobile
```

- [ ] **Step 2: Replace root package.json**

Write `package.json` at repo root:

```json
{
  "name": "myflowy",
  "version": "0.1.0",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "build:core": "yarn workspace @myflowy/core build",
    "test": "yarn workspace @myflowy/core test",
    "test:ci": "yarn workspace @myflowy/core test --reporter=verbose"
  }
}
```

- [ ] **Step 3: Create .npmrc with supply-chain hardening**

Write `.npmrc` at repo root:

```ini
# Disable postInstall scripts by default to guard against supply-chain attacks.
# Packages needing scripts are allowlisted below.
ignore-scripts=true

# electron needs its binary download postInstall script
# Add to allowlist when packages/electron is scaffolded (Plan 3).
# electron=true
```

- [ ] **Step 4: Create shared tsconfig.base.json**

Write `tsconfig.base.json` at repo root:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 5: Verify workspace structure**

```bash
ls packages/
```

Expected output:
```
core   electron   mobile   web
```

- [ ] **Step 6: Commit**

```bash
git add package.json .npmrc tsconfig.base.json packages/
git commit -m "chore: convert to yarn workspaces monorepo with supply-chain hardening"
```

---

## Task 2: Scaffold core package

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/vitest.config.ts`
- Create: `packages/core/src/index.ts`

- [ ] **Step 1: Create packages/core/package.json**

```json
{
  "name": "@myflowy/core",
  "version": "0.1.0",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "build:watch": "tsc --watch",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "idb-keyval": "^6.2.1"
  },
  "devDependencies": {
    "typescript": "^5.4.5",
    "vitest": "^2.1.0",
    "fake-indexeddb": "^5.0.0"
  }
}
```

- [ ] **Step 2: Create packages/core/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "composite": true
  },
  "include": ["src"],
  "exclude": ["src/__tests__", "dist"]
}
```

- [ ] **Step 3: Create packages/core/vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
});
```

- [ ] **Step 4: Create empty barrel export**

Write `packages/core/src/index.ts`:

```typescript
// populated as each module is added
```

- [ ] **Step 5: Install core dependencies**

```bash
yarn workspace @myflowy/core install
```

Expected: resolves idb-keyval, vitest, typescript, fake-indexeddb.

- [ ] **Step 6: Verify TypeScript compiles (empty project)**

```bash
yarn workspace @myflowy/core build
```

Expected: exits 0, creates `packages/core/dist/`.

- [ ] **Step 7: Commit**

```bash
git add packages/core/
git commit -m "chore: scaffold @myflowy/core package"
```

---

## Task 3: Types, utils, and auth

**Files:**
- Create: `packages/core/src/types.ts`
- Create: `packages/core/src/utils.ts`
- Create: `packages/core/src/auth.ts`
- Create: `packages/core/src/__tests__/utils.test.ts`
- Create: `packages/core/src/__tests__/auth.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write failing tests**

Write `packages/core/src/__tests__/utils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { uuid, initialRoot } from '../utils';

describe('uuid', () => {
  it('returns a v4-shaped string', () => {
    const id = uuid();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('returns unique values', () => {
    expect(uuid()).not.toBe(uuid());
  });
});

describe('initialRoot', () => {
  it('returns a root task with id "root"', () => {
    const root = initialRoot();
    expect(root.id).toBe('root');
    expect(root.children).toEqual([]);
    expect(root.checked).toBe(false);
  });
});
```

Write `packages/core/src/__tests__/auth.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { getAccessToken, setAccessToken, clearAccessToken } from '../auth';

describe('auth tokens', () => {
  beforeEach(() => clearAccessToken());

  it('returns null when no token set', () => {
    expect(getAccessToken()).toBeNull();
  });

  it('returns token after setAccessToken', () => {
    setAccessToken('tok-abc');
    expect(getAccessToken()).toBe('tok-abc');
  });

  it('returns null after clearAccessToken', () => {
    setAccessToken('tok-abc');
    clearAccessToken();
    expect(getAccessToken()).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
yarn workspace @myflowy/core test
```

Expected: fails with `Cannot find module '../utils'`

- [ ] **Step 3: Implement types.ts**

Write `packages/core/src/types.ts`:

```typescript
export interface Task {
  id: string;
  text: string;
  checked: boolean;
  pinned: boolean;
  collapsed: boolean;
  children: string[];
}

export type TaskMap = Record<string, Task>;

export interface DriveFile {
  version: number;
  tasks: TaskMap;
  updatedAt: string;
}

export interface LocalStore {
  get(id: string): Promise<Task | undefined>;
  set(task: Task): Promise<void>;
  remove(id: string): Promise<void>;
  getAll(): Promise<TaskMap>;
  setAll(tasks: TaskMap): Promise<void>;
  getPendingUpload(): Promise<boolean>;
  setPendingUpload(pending: boolean): Promise<void>;
  getLastSyncedAt(): Promise<string | null>;
  setLastSyncedAt(iso: string): Promise<void>;
}
```

- [ ] **Step 4: Implement utils.ts**

Write `packages/core/src/utils.ts`:

```typescript
import type { Task } from './types';

export function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, () =>
    Math.floor(Math.random() * 16).toString(16)
  );
}

export function initialRoot(): Task {
  return {
    id: 'root',
    text: '',
    checked: false,
    pinned: false,
    collapsed: false,
    children: [],
  };
}
```

- [ ] **Step 5: Implement auth.ts**

Write `packages/core/src/auth.ts`:

```typescript
let _token: string | null = null;

export function getAccessToken(): string | null {
  return _token;
}

export function setAccessToken(token: string): void {
  _token = token;
}

export function clearAccessToken(): void {
  _token = null;
}
```

- [ ] **Step 6: Run tests — expect PASS**

```bash
yarn workspace @myflowy/core test
```

Expected:
```
✓ utils.test.ts (3)
✓ auth.test.ts (3)
Test Files  2 passed (2)
Tests  6 passed (6)
```

- [ ] **Step 7: Update index.ts barrel**

Write `packages/core/src/index.ts`:

```typescript
export type { Task, TaskMap, LocalStore, DriveFile } from './types';
export { uuid, initialRoot } from './utils';
export { getAccessToken, setAccessToken, clearAccessToken } from './auth';
```

- [ ] **Step 8: Build and verify types emit**

```bash
yarn workspace @myflowy/core build
```

Expected: exits 0. `packages/core/dist/index.d.ts` exists.

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/
git commit -m "feat(core): add Task types, uuid util, and auth token management"
```

---

## Task 4: IDBLocalStore

**Files:**
- Create: `packages/core/src/store/IDBLocalStore.ts`
- Create: `packages/core/src/__tests__/IDBLocalStore.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write failing test**

Write `packages/core/src/__tests__/IDBLocalStore.test.ts`:

```typescript
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { IDBLocalStore } from '../store/IDBLocalStore';
import type { Task } from '../types';

const task: Task = {
  id: 'task-1',
  text: 'Hello',
  checked: false,
  pinned: false,
  collapsed: false,
  children: [],
};

describe('IDBLocalStore', () => {
  let store: IDBLocalStore;

  beforeEach(() => {
    store = new IDBLocalStore();
  });

  it('returns undefined for unknown id', async () => {
    expect(await store.get('missing')).toBeUndefined();
  });

  it('stores and retrieves a task', async () => {
    await store.set(task);
    expect(await store.get('task-1')).toEqual(task);
  });

  it('removes a task', async () => {
    await store.set(task);
    await store.remove('task-1');
    expect(await store.get('task-1')).toBeUndefined();
  });

  it('getAll returns only tasks, not metadata keys', async () => {
    await store.set(task);
    await store.setPendingUpload(true);
    await store.setLastSyncedAt('2026-01-01T00:00:00.000Z');
    const all = await store.getAll();
    expect(all['task-1']).toEqual(task);
    expect(Object.keys(all)).toHaveLength(1);
  });

  it('setAll replaces all tasks', async () => {
    await store.set(task);
    const newTask: Task = { ...task, id: 'task-2', text: 'World' };
    await store.setAll({ 'task-2': newTask });
    expect(await store.get('task-1')).toBeUndefined();
    expect(await store.get('task-2')).toEqual(newTask);
  });

  it('pendingUpload defaults to false', async () => {
    expect(await store.getPendingUpload()).toBe(false);
  });

  it('stores and retrieves pendingUpload', async () => {
    await store.setPendingUpload(true);
    expect(await store.getPendingUpload()).toBe(true);
  });

  it('lastSyncedAt defaults to null', async () => {
    expect(await store.getLastSyncedAt()).toBeNull();
  });

  it('stores and retrieves lastSyncedAt', async () => {
    await store.setLastSyncedAt('2026-05-19T10:00:00.000Z');
    expect(await store.getLastSyncedAt()).toBe('2026-05-19T10:00:00.000Z');
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
yarn workspace @myflowy/core test
```

Expected: fails with `Cannot find module '../store/IDBLocalStore'`

- [ ] **Step 3: Implement IDBLocalStore.ts**

Write `packages/core/src/store/IDBLocalStore.ts`:

```typescript
import { get, set, del, entries, clear } from 'idb-keyval';
import type { Task, TaskMap, LocalStore } from '../types';

const PENDING_KEY = '__pending__';
const SYNCED_AT_KEY = '__synced_at__';
const META_KEYS = new Set([PENDING_KEY, SYNCED_AT_KEY]);

export class IDBLocalStore implements LocalStore {
  async get(id: string): Promise<Task | undefined> {
    return get<Task>(id);
  }

  async set(task: Task): Promise<void> {
    await set(task.id, task);
  }

  async remove(id: string): Promise<void> {
    await del(id);
  }

  async getAll(): Promise<TaskMap> {
    const all = await entries<string, Task>();
    const map: TaskMap = {};
    for (const [key, val] of all) {
      if (!META_KEYS.has(key)) map[key] = val;
    }
    return map;
  }

  async setAll(tasks: TaskMap): Promise<void> {
    await clear();
    await Promise.all(Object.values(tasks).map((t) => set(t.id, t)));
  }

  async getPendingUpload(): Promise<boolean> {
    return (await get<boolean>(PENDING_KEY)) ?? false;
  }

  async setPendingUpload(pending: boolean): Promise<void> {
    await set(PENDING_KEY, pending);
  }

  async getLastSyncedAt(): Promise<string | null> {
    return (await get<string>(SYNCED_AT_KEY)) ?? null;
  }

  async setLastSyncedAt(iso: string): Promise<void> {
    await set(SYNCED_AT_KEY, iso);
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
yarn workspace @myflowy/core test
```

Expected:
```
✓ IDBLocalStore.test.ts (9)
✓ auth.test.ts (3)
✓ utils.test.ts (3)
Test Files  3 passed (3)
Tests  15 passed (15)
```

- [ ] **Step 5: Export from index.ts**

Edit `packages/core/src/index.ts` — add:

```typescript
export { IDBLocalStore } from './store/IDBLocalStore';
```

- [ ] **Step 6: Build**

```bash
yarn workspace @myflowy/core build
```

Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/store/ packages/core/src/__tests__/IDBLocalStore.test.ts packages/core/src/index.ts
git commit -m "feat(core): add IDBLocalStore (IndexedDB LocalStore implementation)"
```

---

## Task 5: Drive API helpers

**Files:**
- Create: `packages/core/src/drive/driveApi.ts`
- Create: `packages/core/src/__tests__/driveApi.test.ts`

- [ ] **Step 1: Write failing tests**

Write `packages/core/src/__tests__/driveApi.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setAccessToken } from '../auth';

// driveApi uses the fetch global — stub it before importing
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

import { findFolder, createFolder, findFile, readFile, createFile, updateFile } from '../drive/driveApi';

beforeEach(() => {
  vi.clearAllMocks();
  setAccessToken('test-token');
});

describe('findFolder', () => {
  it('returns folder id when found', async () => {
    fetchMock.mockResolvedValueOnce({
      json: () => Promise.resolve({ files: [{ id: 'folder-123' }] }),
    });
    expect(await findFolder('MyFlowy')).toBe('folder-123');
  });

  it('returns null when not found', async () => {
    fetchMock.mockResolvedValueOnce({
      json: () => Promise.resolve({ files: [] }),
    });
    expect(await findFolder('MyFlowy')).toBeNull();
  });
});

describe('createFolder', () => {
  it('returns new folder id', async () => {
    fetchMock.mockResolvedValueOnce({
      json: () => Promise.resolve({ id: 'new-folder-id' }),
    });
    expect(await createFolder('MyFlowy')).toBe('new-folder-id');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/drive/v3/files'),
      expect.objectContaining({ method: 'POST' })
    );
  });
});

describe('findFile', () => {
  it('returns file id when found', async () => {
    fetchMock.mockResolvedValueOnce({
      json: () => Promise.resolve({ files: [{ id: 'file-456' }] }),
    });
    expect(await findFile('myflowy.json', 'folder-123')).toBe('file-456');
  });

  it('returns null when not found', async () => {
    fetchMock.mockResolvedValueOnce({
      json: () => Promise.resolve({ files: [] }),
    });
    expect(await findFile('myflowy.json', 'folder-123')).toBeNull();
  });
});

describe('readFile', () => {
  it('returns file text content', async () => {
    fetchMock.mockResolvedValueOnce({ text: () => Promise.resolve('{"version":1}') });
    expect(await readFile('file-456')).toBe('{"version":1}');
  });
});

describe('updateFile', () => {
  it('calls PATCH with content', async () => {
    fetchMock.mockResolvedValueOnce({});
    await updateFile('file-456', '{"version":1}');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('file-456'),
      expect.objectContaining({ method: 'PATCH', body: '{"version":1}' })
    );
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
yarn workspace @myflowy/core test
```

Expected: fails with `Cannot find module '../drive/driveApi'`

- [ ] **Step 3: Implement driveApi.ts**

Write `packages/core/src/drive/driveApi.ts`:

```typescript
import { getAccessToken } from '../auth';

const BASE = 'https://www.googleapis.com';

function authHeader(): string {
  const token = getAccessToken();
  if (!token) throw new Error('No access token set — call setAccessToken() first');
  return `Bearer ${token}`;
}

export async function findFolder(name: string): Promise<string | null> {
  const q = encodeURIComponent(
    `name='${name}' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`
  );
  const res = await fetch(`${BASE}/drive/v3/files?q=${q}&fields=files(id)`, {
    headers: { Authorization: authHeader() },
  });
  const data = await res.json();
  return data.files?.[0]?.id ?? null;
}

export async function createFolder(name: string): Promise<string> {
  const res = await fetch(`${BASE}/drive/v3/files`, {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: ['root'],
    }),
  });
  const data = await res.json();
  return data.id;
}

export async function findFile(name: string, parentId: string): Promise<string | null> {
  const q = encodeURIComponent(
    `name='${name}' and '${parentId}' in parents and trashed=false`
  );
  const res = await fetch(`${BASE}/drive/v3/files?q=${q}&fields=files(id)`, {
    headers: { Authorization: authHeader() },
  });
  const data = await res.json();
  return data.files?.[0]?.id ?? null;
}

export async function readFile(fileId: string): Promise<string> {
  const res = await fetch(`${BASE}/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: authHeader() },
  });
  return res.text();
}

export async function createFile(
  name: string,
  parentId: string,
  content: string
): Promise<string> {
  const metadata = JSON.stringify({ name, parents: [parentId] });
  const body = new FormData();
  body.append('metadata', new Blob([metadata], { type: 'application/json' }));
  body.append('media', new Blob([content], { type: 'application/json' }));
  const res = await fetch(`${BASE}/upload/drive/v3/files?uploadType=multipart`, {
    method: 'POST',
    headers: { Authorization: authHeader() },
    body,
  });
  const data = await res.json();
  return data.id;
}

export async function updateFile(fileId: string, content: string): Promise<void> {
  await fetch(`${BASE}/upload/drive/v3/files/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: content,
  });
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
yarn workspace @myflowy/core test
```

Expected:
```
✓ driveApi.test.ts (7)
✓ IDBLocalStore.test.ts (9)
✓ auth.test.ts (3)
✓ utils.test.ts (3)
Test Files  4 passed (4)
Tests  22 passed (22)
```

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/drive/driveApi.ts packages/core/src/__tests__/driveApi.test.ts
git commit -m "feat(core): add Drive REST API helpers"
```

---

## Task 6: DriveSync

**Files:**
- Create: `packages/core/src/drive/DriveSync.ts`
- Create: `packages/core/src/__tests__/DriveSync.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write failing tests**

Write `packages/core/src/__tests__/DriveSync.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setAccessToken } from '../auth';
import type { DriveFile, TaskMap } from '../types';

// Mock the driveApi module so DriveSync uses our stubs
vi.mock('../drive/driveApi', () => ({
  findFolder: vi.fn(),
  createFolder: vi.fn(),
  findFile: vi.fn(),
  readFile: vi.fn(),
  createFile: vi.fn(),
  updateFile: vi.fn(),
}));

import * as driveApi from '../drive/driveApi';
import { DriveSync } from '../drive/DriveSync';

const mockTasks: TaskMap = {
  root: { id: 'root', text: '', checked: false, pinned: false, collapsed: false, children: [] },
};

beforeEach(() => {
  vi.clearAllMocks();
  setAccessToken('tok');
});

describe('DriveSync.read', () => {
  it('returns null when no file exists', async () => {
    vi.mocked(driveApi.findFolder).mockResolvedValue('folder-id');
    vi.mocked(driveApi.findFile).mockResolvedValue(null);

    const sync = new DriveSync();
    expect(await sync.read()).toBeNull();
  });

  it('parses and returns the DriveFile when found', async () => {
    const driveFile: DriveFile = { version: 1, tasks: mockTasks, updatedAt: '2026-01-01T00:00:00Z' };
    vi.mocked(driveApi.findFolder).mockResolvedValue('folder-id');
    vi.mocked(driveApi.findFile).mockResolvedValue('file-id');
    vi.mocked(driveApi.readFile).mockResolvedValue(JSON.stringify(driveFile));

    const sync = new DriveSync();
    expect(await sync.read()).toEqual(driveFile);
  });
});

describe('DriveSync.write', () => {
  it('creates the file on first write', async () => {
    vi.mocked(driveApi.findFolder).mockResolvedValue('folder-id');
    vi.mocked(driveApi.findFile).mockResolvedValue(null);
    vi.mocked(driveApi.createFile).mockResolvedValue('new-file-id');

    const sync = new DriveSync();
    await sync.write(mockTasks);

    expect(driveApi.createFile).toHaveBeenCalledWith(
      'myflowy.json',
      'folder-id',
      expect.stringContaining('"version":1')
    );
    expect(driveApi.updateFile).not.toHaveBeenCalled();
  });

  it('updates the file on subsequent writes', async () => {
    const driveFile: DriveFile = { version: 1, tasks: mockTasks, updatedAt: '2026-01-01T00:00:00Z' };
    vi.mocked(driveApi.findFolder).mockResolvedValue('folder-id');
    vi.mocked(driveApi.findFile).mockResolvedValue('existing-file-id');
    vi.mocked(driveApi.readFile).mockResolvedValue(JSON.stringify(driveFile));

    const sync = new DriveSync();
    await sync.read(); // caches fileId
    await sync.write(mockTasks);

    expect(driveApi.updateFile).toHaveBeenCalledWith(
      'existing-file-id',
      expect.stringContaining('"version":1')
    );
    expect(driveApi.createFile).not.toHaveBeenCalled();
  });

  it('creates folder when it does not exist', async () => {
    vi.mocked(driveApi.findFolder).mockResolvedValue(null);
    vi.mocked(driveApi.createFolder).mockResolvedValue('new-folder-id');
    vi.mocked(driveApi.findFile).mockResolvedValue(null);
    vi.mocked(driveApi.createFile).mockResolvedValue('new-file-id');

    const sync = new DriveSync();
    await sync.write(mockTasks);

    expect(driveApi.createFolder).toHaveBeenCalledWith('MyFlowy');
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
yarn workspace @myflowy/core test
```

Expected: fails with `Cannot find module '../drive/DriveSync'`

- [ ] **Step 3: Implement DriveSync.ts**

Write `packages/core/src/drive/DriveSync.ts`:

```typescript
import type { DriveFile, TaskMap } from '../types';
import { findFolder, createFolder, findFile, readFile, createFile, updateFile } from './driveApi';

const FOLDER_NAME = 'MyFlowy';
const FILE_NAME = 'myflowy.json';

export class DriveSync {
  private folderId: string | null = null;
  private fileId: string | null = null;

  private async ensureFolder(): Promise<string> {
    if (this.folderId) return this.folderId;
    this.folderId = await findFolder(FOLDER_NAME);
    if (!this.folderId) this.folderId = await createFolder(FOLDER_NAME);
    return this.folderId;
  }

  async read(): Promise<DriveFile | null> {
    const folderId = await this.ensureFolder();
    this.fileId = await findFile(FILE_NAME, folderId);
    if (!this.fileId) return null;
    const raw = await readFile(this.fileId);
    return JSON.parse(raw) as DriveFile;
  }

  async write(tasks: TaskMap): Promise<void> {
    const folderId = await this.ensureFolder();
    if (!this.fileId) {
      this.fileId = await findFile(FILE_NAME, folderId);
    }
    const file: DriveFile = {
      version: 1,
      tasks,
      updatedAt: new Date().toISOString(),
    };
    const content = JSON.stringify(file);
    if (this.fileId) {
      await updateFile(this.fileId, content);
    } else {
      this.fileId = await createFile(FILE_NAME, folderId, content);
    }
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
yarn workspace @myflowy/core test
```

Expected:
```
✓ DriveSync.test.ts (5)
✓ driveApi.test.ts (7)
✓ IDBLocalStore.test.ts (9)
✓ auth.test.ts (3)
✓ utils.test.ts (3)
Test Files  5 passed (5)
Tests  27 passed (27)
```

- [ ] **Step 5: Export from index.ts**

Edit `packages/core/src/index.ts` — add:

```typescript
export { DriveSync } from './drive/DriveSync';
```

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/drive/DriveSync.ts packages/core/src/__tests__/DriveSync.test.ts packages/core/src/index.ts
git commit -m "feat(core): add DriveSync (Google Drive folder + file management)"
```

---

## Task 7: SyncEngine

**Files:**
- Create: `packages/core/src/SyncEngine.ts`
- Create: `packages/core/src/__tests__/SyncEngine.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write failing tests**

Write `packages/core/src/__tests__/SyncEngine.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Task, TaskMap, LocalStore } from '../types';
import type { DriveFile } from '../types';

// In-memory LocalStore for testing
class MemoryStore implements LocalStore {
  tasks: TaskMap = {};
  private pending = false;
  private syncedAt: string | null = null;

  async get(id: string) { return this.tasks[id]; }
  async set(task: Task) { this.tasks = { ...this.tasks, [task.id]: task }; }
  async remove(id: string) {
    const { [id]: _, ...rest } = this.tasks;
    this.tasks = rest;
  }
  async getAll() { return { ...this.tasks }; }
  async setAll(tasks: TaskMap) { this.tasks = { ...tasks }; }
  async getPendingUpload() { return this.pending; }
  async setPendingUpload(p: boolean) { this.pending = p; }
  async getLastSyncedAt() { return this.syncedAt; }
  async setLastSyncedAt(iso: string) { this.syncedAt = iso; }
}

// Minimal DriveSync mock
class MockDriveSync {
  written: TaskMap | null = null;
  readResult: DriveFile | null = null;

  async read() { return this.readResult; }
  async write(tasks: TaskMap) {
    this.written = { ...tasks };
  }
}

import { SyncEngine } from '../SyncEngine';

describe('SyncEngine.initialize', () => {
  it('creates root task when store is empty', async () => {
    const store = new MemoryStore();
    const drive = new MockDriveSync();
    const engine = new SyncEngine(store, drive as any);
    const tasks = await engine.initialize();
    expect(tasks['root']).toBeDefined();
    expect(tasks['root'].id).toBe('root');
  });

  it('returns existing tasks when store has data', async () => {
    const store = new MemoryStore();
    store.tasks = { root: { id: 'root', text: 'hi', checked: false, pinned: false, collapsed: false, children: [] } };
    const drive = new MockDriveSync();
    const engine = new SyncEngine(store, drive as any);
    const tasks = await engine.initialize();
    expect(tasks['root'].text).toBe('hi');
  });
});

describe('SyncEngine.setTask / removeTask', () => {
  it('writes task to local store', async () => {
    const store = new MemoryStore();
    const drive = new MockDriveSync();
    const engine = new SyncEngine(store, drive as any);
    const task: Task = { id: 't1', text: 'A', checked: false, pinned: false, collapsed: false, children: [] };
    await engine.setTask(task);
    expect(await store.get('t1')).toEqual(task);
  });

  it('removes task from local store', async () => {
    const store = new MemoryStore();
    const task: Task = { id: 't1', text: 'A', checked: false, pinned: false, collapsed: false, children: [] };
    store.tasks = { t1: task };
    const drive = new MockDriveSync();
    const engine = new SyncEngine(store, drive as any);
    await engine.removeTask('t1');
    expect(await store.get('t1')).toBeUndefined();
  });
});

describe('SyncEngine.syncFromDrive', () => {
  it('uploads local data and returns null when no Drive file exists', async () => {
    const store = new MemoryStore();
    store.tasks = { root: { id: 'root', text: '', checked: false, pinned: false, collapsed: false, children: [] } };
    const drive = new MockDriveSync();
    const engine = new SyncEngine(store, drive as any);
    const result = await engine.syncFromDrive();
    expect(result).toBeNull();
    expect(drive.written).toEqual(store.tasks);
    expect(await store.getPendingUpload()).toBe(false);
  });

  it('downloads Drive data when Drive is newer', async () => {
    const store = new MemoryStore();
    await store.setLastSyncedAt('2026-01-01T00:00:00.000Z');
    const remoteTasks: TaskMap = {
      root: { id: 'root', text: 'remote', checked: false, pinned: false, collapsed: false, children: [] },
    };
    const drive = new MockDriveSync();
    drive.readResult = { version: 1, tasks: remoteTasks, updatedAt: '2026-06-01T00:00:00.000Z' };

    const engine = new SyncEngine(store, drive as any);
    const result = await engine.syncFromDrive();
    expect(result).toEqual(remoteTasks);
    expect(store.tasks).toEqual(remoteTasks);
    expect(await store.getPendingUpload()).toBe(false);
  });

  it('returns null (no-op) when local is newer than Drive', async () => {
    const store = new MemoryStore();
    await store.setLastSyncedAt('2026-06-01T00:00:00.000Z');
    const drive = new MockDriveSync();
    drive.readResult = { version: 1, tasks: {}, updatedAt: '2026-01-01T00:00:00.000Z' };

    const engine = new SyncEngine(store, drive as any);
    const result = await engine.syncFromDrive();
    expect(result).toBeNull();
  });
});

describe('SyncEngine.onNetworkRestore', () => {
  it('flushes to Drive when pendingUpload is true', async () => {
    const store = new MemoryStore();
    await store.setPendingUpload(true);
    store.tasks = { root: { id: 'root', text: '', checked: false, pinned: false, collapsed: false, children: [] } };
    const drive = new MockDriveSync();
    const engine = new SyncEngine(store, drive as any);
    await engine.onNetworkRestore();
    expect(drive.written).toEqual(store.tasks);
    expect(await store.getPendingUpload()).toBe(false);
  });

  it('does nothing when pendingUpload is false', async () => {
    const store = new MemoryStore();
    const drive = new MockDriveSync();
    const engine = new SyncEngine(store, drive as any);
    await engine.onNetworkRestore();
    expect(drive.written).toBeNull();
  });
});

describe('SyncEngine.flushToDrive', () => {
  it('writes all local tasks to Drive and clears pending flag', async () => {
    const store = new MemoryStore();
    await store.setPendingUpload(true);
    store.tasks = { root: { id: 'root', text: '', checked: false, pinned: false, collapsed: false, children: [] } };
    const drive = new MockDriveSync();
    const engine = new SyncEngine(store, drive as any);
    await engine.flushToDrive();
    expect(drive.written).toEqual(store.tasks);
    expect(await store.getPendingUpload()).toBe(false);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
yarn workspace @myflowy/core test
```

Expected: fails with `Cannot find module '../SyncEngine'`

- [ ] **Step 3: Implement SyncEngine.ts**

Write `packages/core/src/SyncEngine.ts`:

```typescript
import type { Task, TaskMap, LocalStore } from './types';
import { DriveSync } from './drive/DriveSync';
import { initialRoot } from './utils';

export class SyncEngine {
  private store: LocalStore;
  private drive: DriveSync;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly DEBOUNCE_MS = 500;

  constructor(store: LocalStore, drive?: DriveSync) {
    this.store = store;
    this.drive = drive ?? new DriveSync();
  }

  async initialize(): Promise<TaskMap> {
    const tasks = await this.store.getAll();
    if (!tasks['root']) {
      const root = initialRoot();
      await this.store.set(root);
      return { root };
    }
    return tasks;
  }

  async getTask(id: string): Promise<Task | undefined> {
    return this.store.get(id);
  }

  async setTask(task: Task): Promise<void> {
    await this.store.set(task);
    this.scheduleDriveUpload();
  }

  async removeTask(id: string): Promise<void> {
    await this.store.remove(id);
    this.scheduleDriveUpload();
  }

  async syncFromDrive(): Promise<TaskMap | null> {
    const remote = await this.drive.read();

    if (!remote) {
      const tasks = await this.store.getAll();
      await this.drive.write(tasks);
      await this.store.setLastSyncedAt(new Date().toISOString());
      await this.store.setPendingUpload(false);
      return null;
    }

    const lastSynced = await this.store.getLastSyncedAt();
    if (!lastSynced || remote.updatedAt > lastSynced) {
      await this.store.setAll(remote.tasks);
      await this.store.setLastSyncedAt(remote.updatedAt);
      await this.store.setPendingUpload(false);
      return remote.tasks;
    }

    return null;
  }

  async flushToDrive(): Promise<void> {
    const tasks = await this.store.getAll();
    await this.drive.write(tasks);
    await this.store.setLastSyncedAt(new Date().toISOString());
    await this.store.setPendingUpload(false);
  }

  async onNetworkRestore(): Promise<void> {
    const pending = await this.store.getPendingUpload();
    if (pending) await this.flushToDrive();
  }

  private scheduleDriveUpload(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(async () => {
      try {
        await this.flushToDrive();
      } catch {
        await this.store.setPendingUpload(true);
      }
    }, this.DEBOUNCE_MS);
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
yarn workspace @myflowy/core test
```

Expected:
```
✓ SyncEngine.test.ts (9)
✓ DriveSync.test.ts (5)
✓ driveApi.test.ts (7)
✓ IDBLocalStore.test.ts (9)
✓ auth.test.ts (3)
✓ utils.test.ts (3)
Test Files  6 passed (6)
Tests  36 passed (36)
```

- [ ] **Step 5: Export from index.ts**

Final `packages/core/src/index.ts`:

```typescript
export type { Task, TaskMap, LocalStore, DriveFile } from './types';
export { uuid, initialRoot } from './utils';
export { getAccessToken, setAccessToken, clearAccessToken } from './auth';
export { IDBLocalStore } from './store/IDBLocalStore';
export { DriveSync } from './drive/DriveSync';
export { SyncEngine } from './SyncEngine';
```

- [ ] **Step 6: Final build**

```bash
yarn workspace @myflowy/core build
```

Expected: exits 0. `packages/core/dist/index.js` and `packages/core/dist/index.d.ts` exist.

```bash
ls packages/core/dist/
```

Expected output includes: `index.js  index.d.ts  index.js.map`

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/SyncEngine.ts packages/core/src/__tests__/SyncEngine.test.ts packages/core/src/index.ts
git commit -m "feat(core): add SyncEngine — local-first writes with debounced Drive upload and offline queue"
```

---

## Task 8: Remove old toolchain files

The old `src/`, rollup config, and tslint config are now superseded. Preserve them in git history but remove from the working tree.

- [ ] **Step 1: Verify all core tests still pass before deleting**

```bash
yarn workspace @myflowy/core test
```

Expected: 36 passing.

- [ ] **Step 2: Remove old build toolchain files**

```bash
git rm rollup.config.js tslint.json tsconfig.dev.json
git rm -r src/
```

- [ ] **Step 3: Remove old devDependency lock entries by replacing yarn.lock**

The old `yarn.lock` still contains the 179 vulnerable packages from the old toolchain. After removing the old `package.json` entries, regenerate:

```bash
yarn install
```

This regenerates `yarn.lock` with only the new workspace packages. Expected: new `yarn.lock` dramatically smaller and `yarn audit --summary` should show 0 or near-0 vulnerabilities.

- [ ] **Step 4: Verify audit**

```bash
yarn audit --summary 2>&1 | tail -5
```

Expected: `0 vulnerabilities found` (or only low-severity from workspace deps, no criticals).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove old rollup/tslint/node-sass toolchain and src/ directory"
```

---

## Plan 1 Complete ✓

At this point:
- `@myflowy/core` is built, typed, and fully tested (36 tests passing)
- The old vulnerable toolchain is gone
- `yarn.lock` is clean

**Next:** Generate and execute Plan 2 (Web App — React + Vite + GIS OAuth + PWA).

To start Plan 2, invoke the `writing-plans` skill with:
> "Create Plan 2 of the myflowy multiplatform refactor: the web app package. See the approved design spec at docs/superpowers/specs/2026-05-19-myflowy-multiplatform-design.md and completed Plan 1 at docs/superpowers/plans/2026-05-19-myflowy-phase1-monorepo-core.md. Plan 2 covers: packages/web scaffold with React 18 + Vite 5, TaskStore event emitter, useTasks hook, AuthGate with @react-oauth/google (implicit flow, drive.file scope), TaskTree + TaskItem with full keyboard shortcuts, Controls, Sidebar, vite-plugin-pwa, and VITE_GOOGLE_CLIENT_ID env var setup."
