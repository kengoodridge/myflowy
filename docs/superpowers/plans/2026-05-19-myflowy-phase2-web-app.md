# MyFlowy Phase 2 — Web App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `packages/web` — a React 18 + Vite 5 PWA that authenticates via Google OAuth, syncs tasks to Google Drive through `@myflowy/core`, and provides full keyboard-driven task editing.

**Architecture:** `TaskStore` (an `EventTarget` wrapping `SyncEngine`) holds synchronous in-memory state and fires-and-forgets async persistence. `useTasks(store)` subscribes to `change` events and triggers re-renders. `App` owns auth token state and calls `useTasks` once; tasks and focusId flow down as props. `TaskItem` and its children render recursively without a dedicated tree component — mutual recursion is handled by TaskItem rendering its own children as TaskItems.

**Tech Stack:** React 18.3.1, Vite 5.4.0, TypeScript 5.5.0, `@react-oauth/google` 0.12.1 (exact pin), `vite-plugin-pwa` 0.21.0, vitest 2.1.0, @testing-library/react 16, jsdom.

**Spec:** `docs/superpowers/specs/2026-05-19-myflowy-multiplatform-design.md`

**Series:** This is Plan 2 of 4.
- Plan 1: `@myflowy/core` ✅ done
- Plan 3: Electron (shell + loopback OAuth)
- Plan 4: Mobile (Expo + @react-native-google-signin) + GOOGLE_CLOUD_SETUP.md

---

## File Map

```
packages/web/
  package.json
  tsconfig.json
  vite.config.ts           ← React plugin (PWA plugin added in Task 10)
  vitest.config.ts
  index.html
  .env.example
  public/
    icons/
      icon-192.png         ← placeholder PNG (created in Task 10)
      icon-512.png         ← placeholder PNG (created in Task 10)
  src/
    main.tsx               ← mounts App (stub in Task 1, final in Task 10)
    App.tsx                ← root component; token + focusId state (Task 10)
    styles/
      index.css            ← minimal functional styles (Task 10)
    store/
      TaskStore.ts         ← EventTarget wrapping SyncEngine (Task 2)
    hooks/
      useTasks.ts          ← subscribes to TaskStore change events (Task 4)
    utils/
      treeUtils.ts         ← getVisibleOrder() + findParent() (Task 3)
    components/
      AuthGate.tsx         ← GoogleOAuthProvider + sign-in screen (Task 5)
      TaskItem.tsx         ← contenteditable row + keyboard shortcuts (Task 6)
      TaskTree.tsx         ← renders root's children list (Task 7)
      Controls.tsx         ← mobile indent/outdent/move buttons (Task 8)
      Sidebar.tsx          ← keyboard shortcut reference table (Task 9)
    __tests__/
      setup.ts             ← @testing-library/jest-dom import (Task 1)
      TaskStore.test.ts    ← Task 2
      treeUtils.test.ts    ← Task 3
      useTasks.test.tsx    ← Task 4
      AuthGate.test.tsx    ← Task 5
      TaskItem.test.tsx    ← Task 6
      TaskTree.test.tsx    ← Task 7
      Controls.test.tsx    ← Task 8
      Sidebar.test.tsx     ← Task 9
```

---

## Task 1: Scaffold packages/web

**Files:**
- Create: `packages/web/package.json`
- Create: `packages/web/tsconfig.json`
- Create: `packages/web/vite.config.ts`
- Create: `packages/web/vitest.config.ts`
- Create: `packages/web/index.html`
- Create: `packages/web/src/main.tsx`
- Create: `packages/web/src/__tests__/setup.ts`
- Create: `packages/web/.env.example`
- Modify: `.npmrc` (allowlist esbuild)
- Modify: `package.json` (root — add web scripts)

- [ ] **Step 1: Allowlist esbuild in .npmrc**

Vite 5 depends on `esbuild` which needs its postinstall script to download a platform-native binary. Add it to the allowlist in `.npmrc`:

```
# Disable postInstall scripts by default to guard against supply-chain attacks.
# Packages needing scripts are allowlisted below.
ignore-scripts=true

# esbuild needs its binary download postInstall script (required by Vite)
esbuild=true

# electron needs its binary download postInstall script
# Add to allowlist when packages/electron is scaffolded (Plan 3).
# electron=true
```

- [ ] **Step 2: Create packages/web/package.json**

`@react-oauth/google` must be an **exact version pin** (no `^`) per the design spec's supply-chain policy. All other packages use `^`.

```json
{
  "name": "@myflowy/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@myflowy/core": "*",
    "@react-oauth/google": "0.12.1",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^18.3.1",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^25.0.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0",
    "vite-plugin-pwa": "^0.21.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 3: Create packages/web/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "outDir": "dist",
    "rootDir": "src",
    "composite": true,
    "types": ["vitest/globals"]
  },
  "include": ["src"],
  "references": [{ "path": "../core" }]
}
```

- [ ] **Step 4: Create packages/web/vite.config.ts**

PWA plugin is added in Task 10 after icons are created. This is the initial build config.

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
```

- [ ] **Step 5: Create packages/web/vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    passWithNoTests: true,
  },
});
```

- [ ] **Step 6: Create packages/web/index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MyFlowy</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Create packages/web/src/main.tsx (placeholder)**

Final version is written in Task 10. This placeholder lets the build succeed.

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div>MyFlowy loading…</div>
  </React.StrictMode>
);
```

- [ ] **Step 8: Create packages/web/src/__tests__/setup.ts**

```typescript
import '@testing-library/jest-dom';
```

- [ ] **Step 9: Create packages/web/.env.example**

```
VITE_GOOGLE_CLIENT_ID=your-google-client-id-here.apps.googleusercontent.com
```

- [ ] **Step 10: Update root package.json — add web scripts**

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
    "build:web": "yarn workspace @myflowy/web build",
    "dev:web": "yarn workspace @myflowy/web dev",
    "test": "yarn workspace @myflowy/core test && yarn workspace @myflowy/web test",
    "test:ci": "yarn workspace @myflowy/core test --reporter=verbose && yarn workspace @myflowy/web test --reporter=verbose"
  }
}
```

- [ ] **Step 11: Install dependencies**

```bash
yarn install
```

Expected: resolves `@myflowy/core` from the workspace, downloads React, Vite, etc. No errors.

- [ ] **Step 12: Build @myflowy/core (required before web can reference its types)**

```bash
yarn build:core
```

Expected: `packages/core/dist/` created, `tsc` exits 0.

- [ ] **Step 13: Run web tests (passes with no tests yet)**

```bash
yarn workspace @myflowy/web test
```

Expected: `No test files found, exiting with code 0` or similar passing output.

- [ ] **Step 14: Verify web build succeeds**

```bash
yarn workspace @myflowy/web build
```

Expected: `packages/web/dist/` created, no TypeScript errors, Vite exits 0.

- [ ] **Step 15: Commit**

```bash
git add packages/web/package.json packages/web/tsconfig.json packages/web/vite.config.ts packages/web/vitest.config.ts packages/web/index.html packages/web/src/main.tsx packages/web/src/__tests__/setup.ts packages/web/.env.example .npmrc package.json
git commit -m "feat(web): scaffold packages/web with React 18 + Vite 5"
```

---

## Task 2: TaskStore

`TaskStore` extends `EventTarget`. It holds the canonical in-memory `TaskMap`, exposes synchronous mutation methods (which update in-memory state and emit `change` immediately), and fire-and-forgets async persistence via `SyncEngine`.

**Files:**
- Create: `packages/web/src/store/TaskStore.ts`
- Create: `packages/web/src/__tests__/TaskStore.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/web/src/__tests__/TaskStore.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskStore } from '../store/TaskStore';
import type { SyncEngine } from '@myflowy/core';
import { initialRoot } from '@myflowy/core';
import type { Task, TaskMap } from '@myflowy/core';

function makeEngine(initialTasks?: TaskMap): SyncEngine {
  const tasks: TaskMap = initialTasks ?? { root: initialRoot() };
  return {
    initialize: vi.fn().mockResolvedValue(tasks),
    getTask: vi.fn().mockResolvedValue(undefined),
    setTask: vi.fn().mockResolvedValue(undefined),
    removeTask: vi.fn().mockResolvedValue(undefined),
    syncFromDrive: vi.fn().mockResolvedValue(null),
    flushToDrive: vi.fn().mockResolvedValue(undefined),
    onNetworkRestore: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn(),
  } as unknown as SyncEngine;
}

describe('TaskStore', () => {
  let store: TaskStore;
  let engine: SyncEngine;

  beforeEach(() => {
    engine = makeEngine();
    store = new TaskStore(engine);
  });

  describe('initialize', () => {
    it('loads tasks from engine', async () => {
      await store.initialize();
      expect(store.getTasks()).toHaveProperty('root');
    });

    it('emits change event', async () => {
      const listener = vi.fn();
      store.addEventListener('change', listener);
      await store.initialize();
      expect(listener).toHaveBeenCalledOnce();
    });
  });

  describe('syncFromDrive', () => {
    it('updates tasks when drive returns new data', async () => {
      const remoteTask: Task = { id: 'remote1', text: 'from drive', checked: false, pinned: false, collapsed: false, children: [] };
      const remoteRoot = { ...initialRoot(), children: ['remote1'] };
      vi.mocked(engine.syncFromDrive).mockResolvedValueOnce({ root: remoteRoot, remote1: remoteTask });

      await store.initialize();
      await store.syncFromDrive();

      expect(store.getTasks()).toHaveProperty('remote1');
    });

    it('does not emit change when drive returns null', async () => {
      await store.initialize();
      const listener = vi.fn();
      store.addEventListener('change', listener);
      await store.syncFromDrive();
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('updateTask', () => {
    it('updates task in memory and emits change', async () => {
      await store.initialize();
      const root = store.getTasks()['root'];
      const updated = { ...root, text: 'updated' };
      store.updateTask(updated);
      expect(store.getTasks()['root'].text).toBe('updated');
    });

    it('calls engine.setTask asynchronously', async () => {
      await store.initialize();
      const root = store.getTasks()['root'];
      store.updateTask({ ...root, text: 'updated' });
      await Promise.resolve();
      expect(engine.setTask).toHaveBeenCalled();
    });
  });

  describe('addTask', () => {
    it('appends task to parent when afterId is null', async () => {
      await store.initialize();
      const newId = store.addTask('root', null);
      expect(store.getTasks()['root'].children).toEqual([newId]);
    });

    it('inserts task immediately after afterId', async () => {
      await store.initialize();
      const first = store.addTask('root', null);
      const second = store.addTask('root', first);
      expect(store.getTasks()['root'].children).toEqual([first, second]);
    });

    it('returns the new task id', async () => {
      await store.initialize();
      const id = store.addTask('root', null);
      expect(id).toBeTypeOf('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('new task starts empty with no children', async () => {
      await store.initialize();
      const id = store.addTask('root', null);
      const task = store.getTasks()[id];
      expect(task.text).toBe('');
      expect(task.children).toEqual([]);
      expect(task.checked).toBe(false);
    });
  });

  describe('removeTask', () => {
    it('removes task from parent children', async () => {
      await store.initialize();
      const id = store.addTask('root', null);
      store.removeTask(id, 'root');
      expect(store.getTasks()['root'].children).toEqual([]);
    });

    it('removes task from tasks map', async () => {
      await store.initialize();
      const id = store.addTask('root', null);
      store.removeTask(id, 'root');
      expect(store.getTasks()).not.toHaveProperty(id);
    });
  });

  describe('indentTask', () => {
    it('makes task a child of its previous sibling', async () => {
      await store.initialize();
      const first = store.addTask('root', null);
      const second = store.addTask('root', first);
      store.indentTask(second, 'root');
      expect(store.getTasks()['root'].children).toEqual([first]);
      expect(store.getTasks()[first].children).toEqual([second]);
    });

    it('does nothing when task is already first child', async () => {
      await store.initialize();
      const id = store.addTask('root', null);
      store.indentTask(id, 'root');
      expect(store.getTasks()['root'].children).toEqual([id]);
    });
  });

  describe('outdentTask', () => {
    it('moves task to grandparent after parent', async () => {
      await store.initialize();
      const first = store.addTask('root', null);
      const second = store.addTask('root', first);
      store.indentTask(second, 'root'); // second is now child of first
      store.outdentTask(second, first, 'root');
      expect(store.getTasks()['root'].children).toEqual([first, second]);
      expect(store.getTasks()[first].children).toEqual([]);
    });
  });

  describe('moveTaskUp', () => {
    it('swaps task with previous sibling', async () => {
      await store.initialize();
      const first = store.addTask('root', null);
      const second = store.addTask('root', first);
      store.moveTaskUp(second, 'root');
      expect(store.getTasks()['root'].children).toEqual([second, first]);
    });

    it('does nothing when task is first', async () => {
      await store.initialize();
      const id = store.addTask('root', null);
      store.moveTaskUp(id, 'root');
      expect(store.getTasks()['root'].children).toEqual([id]);
    });
  });

  describe('moveTaskDown', () => {
    it('swaps task with next sibling', async () => {
      await store.initialize();
      const first = store.addTask('root', null);
      const second = store.addTask('root', first);
      store.moveTaskDown(first, 'root');
      expect(store.getTasks()['root'].children).toEqual([second, first]);
    });

    it('does nothing when task is last', async () => {
      await store.initialize();
      const id = store.addTask('root', null);
      store.moveTaskDown(id, 'root');
      expect(store.getTasks()['root'].children).toEqual([id]);
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
yarn workspace @myflowy/web test
```

Expected: FAIL — `Cannot find module '../store/TaskStore'`

- [ ] **Step 3: Create packages/web/src/store/TaskStore.ts**

```typescript
import type { Task, TaskMap } from '@myflowy/core';
import { uuid } from '@myflowy/core';
import type { SyncEngine } from '@myflowy/core';

export class TaskStore extends EventTarget {
  private engine: SyncEngine;
  private tasks: TaskMap = {};

  constructor(engine: SyncEngine) {
    super();
    this.engine = engine;
  }

  async initialize(): Promise<void> {
    this.tasks = await this.engine.initialize();
    this.emit();
  }

  async syncFromDrive(): Promise<void> {
    const remote = await this.engine.syncFromDrive();
    if (remote) {
      this.tasks = remote;
      this.emit();
    }
  }

  getTasks(): TaskMap {
    return this.tasks;
  }

  updateTask(task: Task): void {
    this.tasks = { ...this.tasks, [task.id]: task };
    this.emit();
    this.engine.setTask(task).catch(console.error);
  }

  addTask(parentId: string, afterId: string | null): string {
    const id = uuid();
    const newTask: Task = {
      id,
      text: '',
      checked: false,
      pinned: false,
      collapsed: false,
      children: [],
    };
    const parent = this.tasks[parentId];
    const children = [...parent.children];
    if (afterId === null) {
      children.push(id);
    } else {
      const afterIndex = children.indexOf(afterId);
      children.splice(afterIndex + 1, 0, id);
    }
    const updatedParent = { ...parent, children };
    this.tasks = { ...this.tasks, [id]: newTask, [parentId]: updatedParent };
    this.emit();
    this.engine.setTask(newTask).catch(console.error);
    this.engine.setTask(updatedParent).catch(console.error);
    return id;
  }

  removeTask(id: string, parentId: string): void {
    const parent = this.tasks[parentId];
    const updatedParent = { ...parent, children: parent.children.filter((c) => c !== id) };
    const { [id]: _removed, ...rest } = this.tasks;
    this.tasks = { ...rest, [parentId]: updatedParent };
    this.emit();
    this.engine.removeTask(id).catch(console.error);
    this.engine.setTask(updatedParent).catch(console.error);
  }

  indentTask(id: string, parentId: string): void {
    const parent = this.tasks[parentId];
    const idx = parent.children.indexOf(id);
    if (idx === 0) return;
    const newParentId = parent.children[idx - 1];
    const newParent = this.tasks[newParentId];
    const updatedParent = { ...parent, children: parent.children.filter((c) => c !== id) };
    const updatedNewParent = { ...newParent, children: [...newParent.children, id] };
    this.tasks = { ...this.tasks, [parentId]: updatedParent, [newParentId]: updatedNewParent };
    this.emit();
    this.engine.setTask(updatedParent).catch(console.error);
    this.engine.setTask(updatedNewParent).catch(console.error);
  }

  outdentTask(id: string, parentId: string, grandparentId: string): void {
    const parent = this.tasks[parentId];
    const grandparent = this.tasks[grandparentId];
    const parentIdx = grandparent.children.indexOf(parentId);
    const updatedParent = { ...parent, children: parent.children.filter((c) => c !== id) };
    const gpChildren = [...grandparent.children];
    gpChildren.splice(parentIdx + 1, 0, id);
    const updatedGrandparent = { ...grandparent, children: gpChildren };
    this.tasks = { ...this.tasks, [parentId]: updatedParent, [grandparentId]: updatedGrandparent };
    this.emit();
    this.engine.setTask(updatedParent).catch(console.error);
    this.engine.setTask(updatedGrandparent).catch(console.error);
  }

  moveTaskUp(id: string, parentId: string): void {
    const parent = this.tasks[parentId];
    const idx = parent.children.indexOf(id);
    if (idx === 0) return;
    const children = [...parent.children];
    [children[idx - 1], children[idx]] = [children[idx], children[idx - 1]];
    const updatedParent = { ...parent, children };
    this.tasks = { ...this.tasks, [parentId]: updatedParent };
    this.emit();
    this.engine.setTask(updatedParent).catch(console.error);
  }

  moveTaskDown(id: string, parentId: string): void {
    const parent = this.tasks[parentId];
    const idx = parent.children.indexOf(id);
    if (idx === parent.children.length - 1) return;
    const children = [...parent.children];
    [children[idx], children[idx + 1]] = [children[idx + 1], children[idx]];
    const updatedParent = { ...parent, children };
    this.tasks = { ...this.tasks, [parentId]: updatedParent };
    this.emit();
    this.engine.setTask(updatedParent).catch(console.error);
  }

  private emit(): void {
    this.dispatchEvent(new Event('change'));
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
yarn workspace @myflowy/web test
```

Expected: all TaskStore tests pass, no failures.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/store/TaskStore.ts packages/web/src/__tests__/TaskStore.test.ts
git commit -m "feat(web): add TaskStore EventTarget wrapping SyncEngine"
```

---

## Task 3: treeUtils

`getVisibleOrder` does a DFS from root, skipping children of collapsed tasks. `findParent` finds which task has a given id in its children — used by Controls to look up parentId from focusId.

**Files:**
- Create: `packages/web/src/utils/treeUtils.ts`
- Create: `packages/web/src/__tests__/treeUtils.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/web/src/__tests__/treeUtils.test.ts
import { describe, it, expect } from 'vitest';
import { getVisibleOrder, findParent } from '../utils/treeUtils';
import type { TaskMap } from '@myflowy/core';

function makeTask(id: string, children: string[] = [], collapsed = false) {
  return { id, text: id, checked: false, pinned: false, collapsed, children };
}

describe('getVisibleOrder', () => {
  it('returns all non-root tasks in DFS order', () => {
    const tasks: TaskMap = {
      root: makeTask('root', ['a', 'b']),
      a: makeTask('a', ['c']),
      b: makeTask('b'),
      c: makeTask('c'),
    };
    expect(getVisibleOrder('root', tasks)).toEqual(['a', 'c', 'b']);
  });

  it('skips children of collapsed tasks', () => {
    const tasks: TaskMap = {
      root: makeTask('root', ['a', 'b']),
      a: makeTask('a', ['c'], true),
      b: makeTask('b'),
      c: makeTask('c'),
    };
    expect(getVisibleOrder('root', tasks)).toEqual(['a', 'b']);
  });

  it('returns empty array for root with no children', () => {
    const tasks: TaskMap = {
      root: makeTask('root', []),
    };
    expect(getVisibleOrder('root', tasks)).toEqual([]);
  });

  it('skips missing task ids gracefully', () => {
    const tasks: TaskMap = {
      root: makeTask('root', ['a', 'ghost']),
      a: makeTask('a'),
    };
    expect(getVisibleOrder('root', tasks)).toEqual(['a']);
  });
});

describe('findParent', () => {
  it('finds the parent of a task', () => {
    const tasks: TaskMap = {
      root: makeTask('root', ['a']),
      a: makeTask('a', ['b']),
      b: makeTask('b'),
    };
    expect(findParent('b', tasks)).toBe('a');
    expect(findParent('a', tasks)).toBe('root');
  });

  it('returns null when task has no parent', () => {
    const tasks: TaskMap = {
      root: makeTask('root', ['a']),
      a: makeTask('a'),
    };
    expect(findParent('root', tasks)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
yarn workspace @myflowy/web test
```

Expected: FAIL — `Cannot find module '../utils/treeUtils'`

- [ ] **Step 3: Create packages/web/src/utils/treeUtils.ts**

```typescript
import type { TaskMap } from '@myflowy/core';

export function getVisibleOrder(rootId: string, tasks: TaskMap): string[] {
  const order: string[] = [];

  function visit(id: string): void {
    const task = tasks[id];
    if (!task) return;
    if (id !== rootId) order.push(id);
    if (!task.collapsed) {
      for (const childId of task.children) {
        visit(childId);
      }
    }
  }

  visit(rootId);
  return order;
}

export function findParent(id: string, tasks: TaskMap): string | null {
  for (const [taskId, task] of Object.entries(tasks)) {
    if (task.children.includes(id)) return taskId;
  }
  return null;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
yarn workspace @myflowy/web test
```

Expected: all treeUtils tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/utils/treeUtils.ts packages/web/src/__tests__/treeUtils.test.ts
git commit -m "feat(web): add treeUtils — getVisibleOrder and findParent"
```

---

## Task 4: useTasks hook

`useTasks(store)` subscribes to the store's `change` event, calls `store.getTasks()` on each change, and returns the current `TaskMap`. Cleans up the listener on unmount.

**Files:**
- Create: `packages/web/src/hooks/useTasks.ts`
- Create: `packages/web/src/__tests__/useTasks.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// packages/web/src/__tests__/useTasks.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTasks } from '../hooks/useTasks';
import { TaskStore } from '../store/TaskStore';
import type { SyncEngine } from '@myflowy/core';
import { initialRoot } from '@myflowy/core';

function makeEngine(): SyncEngine {
  return {
    initialize: vi.fn().mockResolvedValue({ root: initialRoot() }),
    getTask: vi.fn().mockResolvedValue(undefined),
    setTask: vi.fn().mockResolvedValue(undefined),
    removeTask: vi.fn().mockResolvedValue(undefined),
    syncFromDrive: vi.fn().mockResolvedValue(null),
    flushToDrive: vi.fn().mockResolvedValue(undefined),
    onNetworkRestore: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn(),
  } as unknown as SyncEngine;
}

describe('useTasks', () => {
  it('returns current tasks from the store', async () => {
    const store = new TaskStore(makeEngine());
    await store.initialize();

    const { result } = renderHook(() => useTasks(store));

    expect(result.current).toHaveProperty('root');
  });

  it('returns updated tasks when store emits change', async () => {
    const store = new TaskStore(makeEngine());
    await store.initialize();

    const { result } = renderHook(() => useTasks(store));

    act(() => {
      store.addTask('root', null);
    });

    expect(result.current['root'].children).toHaveLength(1);
  });

  it('unsubscribes from store on unmount', async () => {
    const store = new TaskStore(makeEngine());
    await store.initialize();

    const spy = vi.spyOn(store, 'removeEventListener');
    const { unmount } = renderHook(() => useTasks(store));

    unmount();

    expect(spy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
yarn workspace @myflowy/web test
```

Expected: FAIL — `Cannot find module '../hooks/useTasks'`

- [ ] **Step 3: Create packages/web/src/hooks/useTasks.ts**

```typescript
import { useState, useEffect, useCallback } from 'react';
import type { TaskMap } from '@myflowy/core';
import type { TaskStore } from '../store/TaskStore';

export function useTasks(store: TaskStore): TaskMap {
  const [tasks, setTasks] = useState<TaskMap>(() => store.getTasks());

  const handleChange = useCallback(() => {
    setTasks(store.getTasks());
  }, [store]);

  useEffect(() => {
    store.addEventListener('change', handleChange);
    return () => store.removeEventListener('change', handleChange);
  }, [store, handleChange]);

  return tasks;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
yarn workspace @myflowy/web test
```

Expected: all useTasks tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/hooks/useTasks.ts packages/web/src/__tests__/useTasks.test.tsx
git commit -m "feat(web): add useTasks hook subscribed to TaskStore change events"
```

---

## Task 5: AuthGate

`AuthGate` wraps `GoogleOAuthProvider` from `@react-oauth/google` (exact version 0.12.1 per supply-chain policy). When not authenticated it renders a sign-in button that triggers the GIS implicit/token flow with `drive.file` scope. On success it stores the token in `localStorage` and calls `onSignIn`.

**Files:**
- Create: `packages/web/src/components/AuthGate.tsx`
- Create: `packages/web/src/__tests__/AuthGate.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// packages/web/src/__tests__/AuthGate.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AuthGate } from '../components/AuthGate';

vi.mock('@react-oauth/google', () => ({
  GoogleOAuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useGoogleLogin: vi.fn(),
}));

vi.mock('@myflowy/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@myflowy/core')>();
  return { ...actual, setAccessToken: vi.fn() };
});

import { useGoogleLogin } from '@react-oauth/google';

describe('AuthGate', () => {
  beforeEach(() => {
    vi.mocked(useGoogleLogin).mockReturnValue(vi.fn());
    localStorage.clear();
  });

  it('renders children when authenticated', () => {
    render(
      <AuthGate clientId="test-id" isAuthenticated={true} onSignIn={vi.fn()}>
        <div>App content</div>
      </AuthGate>
    );
    expect(screen.getByText('App content')).toBeInTheDocument();
  });

  it('renders sign-in button when not authenticated', () => {
    render(
      <AuthGate clientId="test-id" isAuthenticated={false} onSignIn={vi.fn()}>
        <div>App content</div>
      </AuthGate>
    );
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.queryByText('App content')).not.toBeInTheDocument();
  });

  it('calls the login function when sign-in button is clicked', () => {
    const mockLogin = vi.fn();
    vi.mocked(useGoogleLogin).mockReturnValue(mockLogin);

    render(
      <AuthGate clientId="test-id" isAuthenticated={false} onSignIn={vi.fn()}>
        <div>App content</div>
      </AuthGate>
    );

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(mockLogin).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
yarn workspace @myflowy/web test
```

Expected: FAIL — `Cannot find module '../components/AuthGate'`

- [ ] **Step 3: Create packages/web/src/components/AuthGate.tsx**

`drive.file` gives access only to files the app created — never the user's broader Drive content.

```tsx
import React from 'react';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import { setAccessToken } from '@myflowy/core';

const SCOPES = 'openid email profile https://www.googleapis.com/auth/drive.file';
const STORAGE_KEY = 'myflowy_access_token';

interface SignInButtonProps {
  onSignIn: (token: string) => void;
}

function SignInButton({ onSignIn }: SignInButtonProps) {
  const login = useGoogleLogin({
    scope: SCOPES,
    onSuccess: (response) => {
      const token = response.access_token;
      localStorage.setItem(STORAGE_KEY, token);
      setAccessToken(token);
      onSignIn(token);
    },
    onError: () => console.error('[AuthGate] Sign in failed'),
  });

  return (
    <div className="auth-gate">
      <h1>MyFlowy</h1>
      <button onClick={() => login()}>Sign in with Google</button>
    </div>
  );
}

export interface AuthGateProps {
  clientId: string;
  isAuthenticated: boolean;
  onSignIn: (token: string) => void;
  children: React.ReactNode;
}

export function AuthGate({ clientId, isAuthenticated, onSignIn, children }: AuthGateProps) {
  return (
    <GoogleOAuthProvider clientId={clientId}>
      {isAuthenticated ? <>{children}</> : <SignInButton onSignIn={onSignIn} />}
    </GoogleOAuthProvider>
  );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
yarn workspace @myflowy/web test
```

Expected: all AuthGate tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/AuthGate.tsx packages/web/src/__tests__/AuthGate.test.tsx
git commit -m "feat(web): add AuthGate with @react-oauth/google GIS implicit flow"
```

---

## Task 6: TaskItem

`TaskItem` renders a single task as a `contenteditable` div. It handles all keyboard shortcuts and renders its children recursively (mutual recursion without a separate TaskTree component). Focus state comes from `focusId` prop; when `focusId === id` the div is focused via a `useEffect`.

**Keyboard shortcuts:**
- `Enter` — add sibling after current task, focus new task
- `Backspace` on empty task with no children — delete task, focus previous in visible order
- `Tab` — indent (make child of previous sibling)
- `Shift+Tab` — outdent (move to grandparent, after parent)
- `Ctrl+ArrowUp` — move task up within parent
- `Ctrl+ArrowDown` — move task down within parent
- `ArrowUp` — focus previous task in DFS visible order
- `ArrowDown` — focus next task in DFS visible order

**Files:**
- Create: `packages/web/src/components/TaskItem.tsx`
- Create: `packages/web/src/__tests__/TaskItem.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// packages/web/src/__tests__/TaskItem.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskItem } from '../components/TaskItem';
import type { TaskMap } from '@myflowy/core';
import type { TaskStore } from '../store/TaskStore';

function makeTask(id: string, text = '', children: string[] = []) {
  return { id, text, checked: false, pinned: false, collapsed: false, children };
}

function makeMap(defs: Record<string, { text?: string; children?: string[] }>): TaskMap {
  const m: TaskMap = {};
  for (const [id, { text = id, children = [] }] of Object.entries(defs)) {
    m[id] = makeTask(id, text, children);
  }
  return m;
}

function makeStore(overrides: Partial<TaskStore> = {}): TaskStore {
  return {
    addTask: vi.fn().mockReturnValue('new-id'),
    removeTask: vi.fn(),
    updateTask: vi.fn(),
    indentTask: vi.fn(),
    outdentTask: vi.fn(),
    moveTaskUp: vi.fn(),
    moveTaskDown: vi.fn(),
    getTasks: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    initialize: vi.fn(),
    syncFromDrive: vi.fn(),
    ...overrides,
  } as unknown as TaskStore;
}

function renderItem(
  tasks: TaskMap,
  id: string,
  parentId: string,
  opts: {
    focusId?: string | null;
    onFocusRequest?: (id: string | null) => void;
    store?: TaskStore;
  } = {}
) {
  const store = opts.store ?? makeStore();
  const onFocusRequest = opts.onFocusRequest ?? vi.fn();
  render(
    <TaskItem
      id={id}
      parentId={parentId}
      tasks={tasks}
      store={store}
      depth={0}
      focusId={opts.focusId ?? null}
      onFocusRequest={onFocusRequest}
    />
  );
  return { store, onFocusRequest };
}

describe('TaskItem', () => {
  it('renders task text', () => {
    const tasks = makeMap({ root: { children: ['a'] }, a: { text: 'Hello' } });
    renderItem(tasks, 'a', 'root');
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('renders children recursively', () => {
    const tasks = makeMap({
      root: { children: ['a'] },
      a: { text: 'Parent', children: ['b'] },
      b: { text: 'Child' },
    });
    renderItem(tasks, 'a', 'root');
    expect(screen.getByText('Parent')).toBeInTheDocument();
    expect(screen.getByText('Child')).toBeInTheDocument();
  });

  describe('keyboard: Enter', () => {
    it('calls store.addTask with parentId and current id', () => {
      const tasks = makeMap({ root: { children: ['a'] }, a: { text: 'Hello' } });
      const { store } = renderItem(tasks, 'a', 'root');
      const editable = document.querySelector('[contenteditable]')!;
      fireEvent.keyDown(editable, { key: 'Enter' });
      expect(store.addTask).toHaveBeenCalledWith('root', 'a');
    });

    it('calls onFocusRequest with the new task id', () => {
      const tasks = makeMap({ root: { children: ['a'] }, a: { text: 'Hello' } });
      const onFocusRequest = vi.fn();
      const store = makeStore({ addTask: vi.fn().mockReturnValue('new-id') });
      renderItem(tasks, 'a', 'root', { store, onFocusRequest });
      fireEvent.keyDown(document.querySelector('[contenteditable]')!, { key: 'Enter' });
      expect(onFocusRequest).toHaveBeenCalledWith('new-id');
    });
  });

  describe('keyboard: Backspace on empty', () => {
    it('calls store.removeTask when task is empty with no children', () => {
      const tasks = makeMap({ root: { children: ['a'] }, a: { text: '' } });
      const { store } = renderItem(tasks, 'a', 'root');
      fireEvent.keyDown(document.querySelector('[contenteditable]')!, { key: 'Backspace' });
      expect(store.removeTask).toHaveBeenCalledWith('a', 'root');
    });

    it('does not call store.removeTask when task has text', () => {
      const tasks = makeMap({ root: { children: ['a'] }, a: { text: 'has text' } });
      const { store } = renderItem(tasks, 'a', 'root');
      fireEvent.keyDown(document.querySelector('[contenteditable]')!, { key: 'Backspace' });
      expect(store.removeTask).not.toHaveBeenCalled();
    });

    it('does not call store.removeTask when task has children', () => {
      const tasks = makeMap({
        root: { children: ['a'] },
        a: { text: '', children: ['b'] },
        b: { text: 'child' },
      });
      const { store } = renderItem(tasks, 'a', 'root');
      fireEvent.keyDown(document.querySelector('[contenteditable]')!, { key: 'Backspace' });
      expect(store.removeTask).not.toHaveBeenCalled();
    });
  });

  describe('keyboard: Tab', () => {
    it('calls store.indentTask with id and parentId', () => {
      const tasks = makeMap({ root: { children: ['a', 'b'] }, a: {}, b: {} });
      const { store } = renderItem(tasks, 'b', 'root');
      fireEvent.keyDown(document.querySelector('[contenteditable]')!, { key: 'Tab', shiftKey: false });
      expect(store.indentTask).toHaveBeenCalledWith('b', 'root');
    });
  });

  describe('keyboard: Shift+Tab', () => {
    it('calls store.outdentTask when grandparent exists', () => {
      const tasks = makeMap({
        root: { children: ['a'] },
        a: { children: ['b'] },
        b: {},
      });
      const { store } = renderItem(tasks, 'b', 'a');
      fireEvent.keyDown(document.querySelector('[contenteditable]')!, { key: 'Tab', shiftKey: true });
      expect(store.outdentTask).toHaveBeenCalledWith('b', 'a', 'root');
    });

    it('does not call store.outdentTask when already at root level', () => {
      const tasks = makeMap({ root: { children: ['a'] }, a: {} });
      const { store } = renderItem(tasks, 'a', 'root');
      fireEvent.keyDown(document.querySelector('[contenteditable]')!, { key: 'Tab', shiftKey: true });
      expect(store.outdentTask).not.toHaveBeenCalled();
    });
  });

  describe('keyboard: Ctrl+ArrowUp / Ctrl+ArrowDown', () => {
    it('calls store.moveTaskUp on Ctrl+ArrowUp', () => {
      const tasks = makeMap({ root: { children: ['a', 'b'] }, a: {}, b: {} });
      const { store } = renderItem(tasks, 'b', 'root');
      fireEvent.keyDown(document.querySelector('[contenteditable]')!, { key: 'ArrowUp', ctrlKey: true });
      expect(store.moveTaskUp).toHaveBeenCalledWith('b', 'root');
    });

    it('calls store.moveTaskDown on Ctrl+ArrowDown', () => {
      const tasks = makeMap({ root: { children: ['a', 'b'] }, a: {}, b: {} });
      const { store } = renderItem(tasks, 'a', 'root');
      fireEvent.keyDown(document.querySelector('[contenteditable]')!, { key: 'ArrowDown', ctrlKey: true });
      expect(store.moveTaskDown).toHaveBeenCalledWith('a', 'root');
    });
  });

  describe('keyboard: ArrowUp / ArrowDown navigation', () => {
    it('calls onFocusRequest with previous task on ArrowUp', () => {
      const tasks = makeMap({ root: { children: ['a', 'b'] }, a: {}, b: {} });
      const onFocusRequest = vi.fn();
      renderItem(tasks, 'b', 'root', { onFocusRequest });
      fireEvent.keyDown(document.querySelector('[contenteditable]')!, { key: 'ArrowUp', ctrlKey: false });
      expect(onFocusRequest).toHaveBeenCalledWith('a');
    });

    it('calls onFocusRequest with next task on ArrowDown', () => {
      const tasks = makeMap({ root: { children: ['a', 'b'] }, a: {}, b: {} });
      const onFocusRequest = vi.fn();
      renderItem(tasks, 'a', 'root', { onFocusRequest });
      fireEvent.keyDown(document.querySelector('[contenteditable]')!, { key: 'ArrowDown', ctrlKey: false });
      expect(onFocusRequest).toHaveBeenCalledWith('b');
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
yarn workspace @myflowy/web test
```

Expected: FAIL — `Cannot find module '../components/TaskItem'`

- [ ] **Step 3: Create packages/web/src/components/TaskItem.tsx**

```tsx
import React, { useRef, useEffect } from 'react';
import type { TaskMap } from '@myflowy/core';
import type { TaskStore } from '../store/TaskStore';
import { getVisibleOrder, findParent } from '../utils/treeUtils';

export interface TaskItemProps {
  id: string;
  parentId: string;
  tasks: TaskMap;
  store: TaskStore;
  depth: number;
  focusId: string | null;
  onFocusRequest: (id: string | null) => void;
}

export function TaskItem({ id, parentId, tasks, store, depth, focusId, onFocusRequest }: TaskItemProps) {
  const task = tasks[id];
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusId === id && divRef.current && document.activeElement !== divRef.current) {
      divRef.current.focus();
    }
  }, [focusId, id]);

  if (!task) return null;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case 'Enter': {
        e.preventDefault();
        const newId = store.addTask(parentId, id);
        onFocusRequest(newId);
        break;
      }
      case 'Backspace': {
        if (task.text === '' && task.children.length === 0) {
          e.preventDefault();
          const order = getVisibleOrder('root', tasks);
          const idx = order.indexOf(id);
          const prevId = idx > 0 ? order[idx - 1] : null;
          store.removeTask(id, parentId);
          onFocusRequest(prevId);
        }
        break;
      }
      case 'Tab': {
        e.preventDefault();
        if (e.shiftKey) {
          const grandparentId = findParent(parentId, tasks);
          if (grandparentId) {
            store.outdentTask(id, parentId, grandparentId);
            onFocusRequest(id);
          }
        } else {
          store.indentTask(id, parentId);
          onFocusRequest(id);
        }
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        if (e.ctrlKey) {
          store.moveTaskUp(id, parentId);
          onFocusRequest(id);
        } else {
          const order = getVisibleOrder('root', tasks);
          const idx = order.indexOf(id);
          if (idx > 0) onFocusRequest(order[idx - 1]);
        }
        break;
      }
      case 'ArrowDown': {
        e.preventDefault();
        if (e.ctrlKey) {
          store.moveTaskDown(id, parentId);
          onFocusRequest(id);
        } else {
          const order = getVisibleOrder('root', tasks);
          const idx = order.indexOf(id);
          if (idx < order.length - 1) onFocusRequest(order[idx + 1]);
        }
        break;
      }
    }
  };

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    store.updateTask({ ...task, text: e.currentTarget.textContent ?? '' });
  };

  return (
    <div className="task-item">
      <div className="task-row">
        <div
          ref={divRef}
          className="task-text"
          contentEditable
          suppressContentEditableWarning
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          data-testid={`task-${id}`}
        >
          {task.text}
        </div>
      </div>
      {!task.collapsed && task.children.length > 0 && (
        <div className="task-children">
          {task.children.map((childId) => (
            <TaskItem
              key={childId}
              id={childId}
              parentId={id}
              tasks={tasks}
              store={store}
              depth={depth + 1}
              focusId={focusId}
              onFocusRequest={onFocusRequest}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
yarn workspace @myflowy/web test
```

Expected: all TaskItem tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/TaskItem.tsx packages/web/src/__tests__/TaskItem.test.tsx
git commit -m "feat(web): add TaskItem with keyboard shortcuts and recursive children"
```

---

## Task 7: TaskTree

`TaskTree` renders the root task's children as a list of `TaskItem` components. It receives tasks and focusId as props (subscribed once in App); it does not call `useTasks` itself.

**Files:**
- Create: `packages/web/src/components/TaskTree.tsx`
- Create: `packages/web/src/__tests__/TaskTree.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// packages/web/src/__tests__/TaskTree.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TaskTree } from '../components/TaskTree';
import type { TaskMap } from '@myflowy/core';
import type { TaskStore } from '../store/TaskStore';

function makeMap(defs: Record<string, { text?: string; children?: string[] }>): TaskMap {
  const m: TaskMap = {};
  for (const [id, { text = id, children = [] }] of Object.entries(defs)) {
    m[id] = { id, text, checked: false, pinned: false, collapsed: false, children };
  }
  return m;
}

function makeStore(): TaskStore {
  return {
    addTask: vi.fn().mockReturnValue('new-id'),
    removeTask: vi.fn(),
    updateTask: vi.fn(),
    indentTask: vi.fn(),
    outdentTask: vi.fn(),
    moveTaskUp: vi.fn(),
    moveTaskDown: vi.fn(),
    getTasks: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    initialize: vi.fn(),
    syncFromDrive: vi.fn(),
  } as unknown as TaskStore;
}

describe('TaskTree', () => {
  it('renders each top-level task', () => {
    const tasks = makeMap({
      root: { children: ['a', 'b'] },
      a: { text: 'Alpha' },
      b: { text: 'Beta' },
    });
    render(
      <TaskTree
        rootId="root"
        tasks={tasks}
        store={makeStore()}
        focusId={null}
        onFocusRequest={vi.fn()}
      />
    );
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('renders nested children via TaskItem', () => {
    const tasks = makeMap({
      root: { children: ['a'] },
      a: { text: 'Parent', children: ['b'] },
      b: { text: 'Child' },
    });
    render(
      <TaskTree
        rootId="root"
        tasks={tasks}
        store={makeStore()}
        focusId={null}
        onFocusRequest={vi.fn()}
      />
    );
    expect(screen.getByText('Parent')).toBeInTheDocument();
    expect(screen.getByText('Child')).toBeInTheDocument();
  });

  it('renders nothing when root is missing', () => {
    const { container } = render(
      <TaskTree
        rootId="root"
        tasks={{}}
        store={makeStore()}
        focusId={null}
        onFocusRequest={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
yarn workspace @myflowy/web test
```

Expected: FAIL — `Cannot find module '../components/TaskTree'`

- [ ] **Step 3: Create packages/web/src/components/TaskTree.tsx**

```tsx
import React from 'react';
import type { TaskMap } from '@myflowy/core';
import type { TaskStore } from '../store/TaskStore';
import { TaskItem } from './TaskItem';

export interface TaskTreeProps {
  rootId: string;
  tasks: TaskMap;
  store: TaskStore;
  focusId: string | null;
  onFocusRequest: (id: string | null) => void;
}

export function TaskTree({ rootId, tasks, store, focusId, onFocusRequest }: TaskTreeProps) {
  const root = tasks[rootId];
  if (!root) return null;

  return (
    <div className="task-tree">
      {root.children.map((childId) => (
        <TaskItem
          key={childId}
          id={childId}
          parentId={rootId}
          tasks={tasks}
          store={store}
          depth={0}
          focusId={focusId}
          onFocusRequest={onFocusRequest}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
yarn workspace @myflowy/web test
```

Expected: all TaskTree tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/TaskTree.tsx packages/web/src/__tests__/TaskTree.test.tsx
git commit -m "feat(web): add TaskTree rendering root children via TaskItem"
```

---

## Task 8: Controls

`Controls` renders four buttons for indent (→), outdent (←), move up (↑), move down (↓). Buttons are disabled when no task is focused or the operation is invalid (e.g., outdent when already at root level). Clicking a button calls the corresponding `TaskStore` method then keeps focus on the same task.

**Files:**
- Create: `packages/web/src/components/Controls.tsx`
- Create: `packages/web/src/__tests__/Controls.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// packages/web/src/__tests__/Controls.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Controls } from '../components/Controls';
import type { TaskMap } from '@myflowy/core';
import type { TaskStore } from '../store/TaskStore';

function makeMap(defs: Record<string, { children?: string[] }>): TaskMap {
  const m: TaskMap = {};
  for (const [id, { children = [] }] of Object.entries(defs)) {
    m[id] = { id, text: id, checked: false, pinned: false, collapsed: false, children };
  }
  return m;
}

function makeStore(): TaskStore {
  return {
    indentTask: vi.fn(),
    outdentTask: vi.fn(),
    moveTaskUp: vi.fn(),
    moveTaskDown: vi.fn(),
    addTask: vi.fn(),
    removeTask: vi.fn(),
    updateTask: vi.fn(),
    getTasks: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    initialize: vi.fn(),
    syncFromDrive: vi.fn(),
  } as unknown as TaskStore;
}

describe('Controls', () => {
  it('renders 4 buttons', () => {
    render(
      <Controls tasks={{}} store={makeStore()} focusId={null} onFocusRequest={vi.fn()} />
    );
    expect(screen.getAllByRole('button')).toHaveLength(4);
  });

  it('all buttons are disabled when focusId is null', () => {
    render(
      <Controls tasks={{}} store={makeStore()} focusId={null} onFocusRequest={vi.fn()} />
    );
    screen.getAllByRole('button').forEach((btn) => expect(btn).toBeDisabled());
  });

  it('indent button calls store.indentTask and keeps focus', () => {
    const tasks = makeMap({ root: { children: ['a', 'b'] }, a: {}, b: {} });
    const store = makeStore();
    const onFocusRequest = vi.fn();

    render(<Controls tasks={tasks} store={store} focusId="b" onFocusRequest={onFocusRequest} />);

    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(store.indentTask).toHaveBeenCalledWith('b', 'root');
    expect(onFocusRequest).toHaveBeenCalledWith('b');
  });

  it('outdent button calls store.outdentTask and keeps focus', () => {
    const tasks = makeMap({
      root: { children: ['a'] },
      a: { children: ['b'] },
      b: {},
    });
    const store = makeStore();
    const onFocusRequest = vi.fn();

    render(<Controls tasks={tasks} store={store} focusId="b" onFocusRequest={onFocusRequest} />);

    fireEvent.click(screen.getAllByRole('button')[1]);
    expect(store.outdentTask).toHaveBeenCalledWith('b', 'a', 'root');
    expect(onFocusRequest).toHaveBeenCalledWith('b');
  });

  it('move up button calls store.moveTaskUp', () => {
    const tasks = makeMap({ root: { children: ['a', 'b'] }, a: {}, b: {} });
    const store = makeStore();

    render(<Controls tasks={tasks} store={store} focusId="b" onFocusRequest={vi.fn()} />);

    fireEvent.click(screen.getAllByRole('button')[2]);
    expect(store.moveTaskUp).toHaveBeenCalledWith('b', 'root');
  });

  it('move down button calls store.moveTaskDown', () => {
    const tasks = makeMap({ root: { children: ['a', 'b'] }, a: {}, b: {} });
    const store = makeStore();

    render(<Controls tasks={tasks} store={store} focusId="a" onFocusRequest={vi.fn()} />);

    fireEvent.click(screen.getAllByRole('button')[3]);
    expect(store.moveTaskDown).toHaveBeenCalledWith('a', 'root');
  });

  it('outdent button is disabled when focused task is at root level (no grandparent)', () => {
    const tasks = makeMap({ root: { children: ['a'] }, a: {} });

    render(<Controls tasks={tasks} store={makeStore()} focusId="a" onFocusRequest={vi.fn()} />);

    expect(screen.getAllByRole('button')[1]).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
yarn workspace @myflowy/web test
```

Expected: FAIL — `Cannot find module '../components/Controls'`

- [ ] **Step 3: Create packages/web/src/components/Controls.tsx**

```tsx
import React from 'react';
import type { TaskMap } from '@myflowy/core';
import type { TaskStore } from '../store/TaskStore';
import { findParent } from '../utils/treeUtils';

export interface ControlsProps {
  tasks: TaskMap;
  store: TaskStore;
  focusId: string | null;
  onFocusRequest: (id: string | null) => void;
}

export function Controls({ tasks, store, focusId, onFocusRequest }: ControlsProps) {
  const parentId = focusId ? findParent(focusId, tasks) : null;
  const grandparentId = parentId ? findParent(parentId, tasks) : null;

  const keepFocus = () => onFocusRequest(focusId);

  return (
    <div className="controls">
      <button
        disabled={!focusId || !parentId}
        onClick={() => {
          if (focusId && parentId) {
            store.indentTask(focusId, parentId);
            keepFocus();
          }
        }}
      >
        →
      </button>
      <button
        disabled={!focusId || !parentId || !grandparentId}
        onClick={() => {
          if (focusId && parentId && grandparentId) {
            store.outdentTask(focusId, parentId, grandparentId);
            keepFocus();
          }
        }}
      >
        ←
      </button>
      <button
        disabled={!focusId || !parentId}
        onClick={() => {
          if (focusId && parentId) {
            store.moveTaskUp(focusId, parentId);
            keepFocus();
          }
        }}
      >
        ↑
      </button>
      <button
        disabled={!focusId || !parentId}
        onClick={() => {
          if (focusId && parentId) {
            store.moveTaskDown(focusId, parentId);
            keepFocus();
          }
        }}
      >
        ↓
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
yarn workspace @myflowy/web test
```

Expected: all Controls tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/Controls.tsx packages/web/src/__tests__/Controls.test.tsx
git commit -m "feat(web): add Controls bar with indent/outdent/move buttons"
```

---

## Task 9: Sidebar

`Sidebar` is a static component displaying the full keyboard shortcut reference and a brief "about" section.

**Files:**
- Create: `packages/web/src/components/Sidebar.tsx`
- Create: `packages/web/src/__tests__/Sidebar.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// packages/web/src/__tests__/Sidebar.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Sidebar } from '../components/Sidebar';

describe('Sidebar', () => {
  it('renders keyboard shortcuts table', () => {
    render(<Sidebar />);
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('lists all shortcut keys', () => {
    render(<Sidebar />);
    expect(screen.getByText('Enter')).toBeInTheDocument();
    expect(screen.getByText('Backspace')).toBeInTheDocument();
    expect(screen.getByText('Tab')).toBeInTheDocument();
    expect(screen.getByText('Shift+Tab')).toBeInTheDocument();
    expect(screen.getByText('Ctrl+↑')).toBeInTheDocument();
    expect(screen.getByText('Ctrl+↓')).toBeInTheDocument();
    expect(screen.getByText('↑ / ↓')).toBeInTheDocument();
  });

  it('renders about section with app name', () => {
    render(<Sidebar />);
    expect(screen.getByText('MyFlowy')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
yarn workspace @myflowy/web test
```

Expected: FAIL — `Cannot find module '../components/Sidebar'`

- [ ] **Step 3: Create packages/web/src/components/Sidebar.tsx**

```tsx
import React from 'react';

const SHORTCUTS = [
  { key: 'Enter', action: 'Add task below' },
  { key: 'Backspace', action: 'Delete empty task' },
  { key: 'Tab', action: 'Indent task' },
  { key: 'Shift+Tab', action: 'Outdent task' },
  { key: 'Ctrl+↑', action: 'Move task up' },
  { key: 'Ctrl+↓', action: 'Move task down' },
  { key: '↑ / ↓', action: 'Navigate tasks' },
];

export function Sidebar() {
  return (
    <aside className="sidebar">
      <h2>Keyboard Shortcuts</h2>
      <table>
        <tbody>
          {SHORTCUTS.map(({ key, action }) => (
            <tr key={key}>
              <td>
                <kbd>{key}</kbd>
              </td>
              <td>{action}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <section>
        <h2>About</h2>
        <p>
          <strong>MyFlowy</strong> — a local-first outliner backed by Google Drive.
        </p>
      </section>
    </aside>
  );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
yarn workspace @myflowy/web test
```

Expected: all Sidebar tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/Sidebar.tsx packages/web/src/__tests__/Sidebar.test.tsx
git commit -m "feat(web): add Sidebar with keyboard shortcuts reference"
```

---

## Task 10: App.tsx + PWA wiring

Wire everything together: `App` owns auth token state and `focusId` state, calls `useTasks(store)` once, and renders `AuthGate > TaskTree + Controls + Sidebar`. Add `vite-plugin-pwa` with placeholder icons and update the root `main.tsx` to mount `App`.

**Files:**
- Create: `packages/web/src/App.tsx`
- Create: `packages/web/src/styles/index.css`
- Modify: `packages/web/src/main.tsx`
- Modify: `packages/web/vite.config.ts`
- Create: `packages/web/public/icons/icon-192.png`
- Create: `packages/web/public/icons/icon-512.png`

- [ ] **Step 1: Create packages/web/src/App.tsx**

`IDBLocalStore`, `SyncEngine`, and `TaskStore` are module-level singletons — they outlive renders and are created once.

```tsx
import React, { useState, useEffect } from 'react';
import { IDBLocalStore, SyncEngine, setAccessToken } from '@myflowy/core';
import { TaskStore } from './store/TaskStore';
import { useTasks } from './hooks/useTasks';
import { AuthGate } from './components/AuthGate';
import { TaskTree } from './components/TaskTree';
import { Controls } from './components/Controls';
import { Sidebar } from './components/Sidebar';
import './styles/index.css';

const STORAGE_KEY = 'myflowy_access_token';

const localStore = new IDBLocalStore('myflowy');
const engine = new SyncEngine(localStore);
const taskStore = new TaskStore(engine);

export function App() {
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY)
  );
  const tasks = useTasks(taskStore);
  const [focusId, setFocusId] = useState<string | null>(null);

  useEffect(() => {
    if (token) setAccessToken(token);
    taskStore.initialize().then(() => {
      if (token) taskStore.syncFromDrive().catch(console.error);
    });
    return () => engine.destroy();
  }, []); // intentionally empty — run once on mount

  const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;

  return (
    <AuthGate clientId={CLIENT_ID} isAuthenticated={!!token} onSignIn={setToken}>
      <TaskTree
        rootId="root"
        tasks={tasks}
        store={taskStore}
        focusId={focusId}
        onFocusRequest={setFocusId}
      />
      <Controls
        tasks={tasks}
        store={taskStore}
        focusId={focusId}
        onFocusRequest={setFocusId}
      />
      <Sidebar />
    </AuthGate>
  );
}
```

- [ ] **Step 2: Create packages/web/src/styles/index.css**

```css
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
  max-width: 800px;
  margin: 0 auto;
  padding: 1rem;
  padding-bottom: 4rem;
}

.auth-gate {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  margin-top: 4rem;
}

.auth-gate button {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  cursor: pointer;
}

.task-tree {
  margin-top: 1rem;
}

.task-item {
  display: flex;
  flex-direction: column;
}

.task-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.125rem 0;
}

.task-text {
  flex: 1;
  outline: none;
  min-height: 1.25em;
  border-radius: 2px;
  padding: 1px 2px;
}

.task-text:focus {
  background: #f0f0ff;
}

.task-children {
  margin-left: 1.5rem;
}

.controls {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #f5f5f5;
  border-top: 1px solid #ddd;
}

.controls button {
  flex: 1;
  padding: 0.5rem;
  font-size: 1.25rem;
  cursor: pointer;
}

.controls button:disabled {
  opacity: 0.4;
  cursor: default;
}

.sidebar {
  margin-top: 2rem;
  padding: 1rem;
  background: #fafafa;
  border: 1px solid #eee;
  border-radius: 4px;
}

.sidebar h2 {
  margin-bottom: 0.75rem;
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #666;
}

.sidebar table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1.5rem;
}

.sidebar td {
  padding: 0.25rem 0.5rem;
  border-bottom: 1px solid #eee;
  font-size: 0.875rem;
}

.sidebar kbd {
  background: #eee;
  border-radius: 3px;
  padding: 1px 4px;
  font-family: monospace;
}

.sidebar section {
  font-size: 0.875rem;
  color: #555;
}
```

- [ ] **Step 3: Update packages/web/src/main.tsx to mount App**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 4: Create placeholder PNG icons**

```bash
cd packages/web && node -e "
const fs = require('fs');
fs.mkdirSync('public/icons', { recursive: true });
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);
fs.writeFileSync('public/icons/icon-192.png', png);
fs.writeFileSync('public/icons/icon-512.png', png);
console.log('Created placeholder icons');
" && cd ../..
```

Expected output: `Created placeholder icons`

- [ ] **Step 5: Add VitePWA to vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'MyFlowy',
        short_name: 'MyFlowy',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
});
```

- [ ] **Step 6: Run all tests to confirm nothing is broken**

```bash
yarn test
```

Expected: all packages/core and packages/web tests pass.

- [ ] **Step 7: Verify production build succeeds**

```bash
yarn workspace @myflowy/web build
```

Expected: `packages/web/dist/` created, TypeScript and Vite both exit 0, `dist/manifest.webmanifest` present (PWA manifest generated).

- [ ] **Step 8: Verify dev server starts**

```bash
yarn dev:web &
sleep 3
curl -s http://localhost:5173 | grep -q 'MyFlowy' && echo "Dev server OK" || echo "Dev server NOT OK"
kill %1
```

Expected: `Dev server OK`

- [ ] **Step 9: Commit**

```bash
git add packages/web/src/App.tsx packages/web/src/styles/index.css packages/web/src/main.tsx packages/web/vite.config.ts packages/web/public/icons/
git commit -m "feat(web): wire App.tsx, PWA manifest, and placeholder icons"
```

---

## Self-Review

### Spec coverage

| Spec requirement | Task |
|---|---|
| React + Vite + TypeScript | Task 1 |
| `@react-oauth/google` exact pin, `drive.file` scope, implicit flow | Task 5 |
| `localStorage` token persistence, `setAccessToken` on startup | Task 5, 10 |
| EventTarget state management, no external store library | Task 2 |
| `useTasks` hook subscribed to store | Task 4 |
| TaskTree recursive rendering | Task 6, 7 |
| Enter / Backspace / Tab / Shift+Tab keyboard shortcuts | Task 6 |
| Ctrl+↑ / Ctrl+↓ move shortcuts | Task 6 |
| ↑ / ↓ navigation via visible order | Task 3, 6 |
| Controls (indent/outdent/move buttons) | Task 8 |
| Sidebar (shortcuts reference) | Task 9 |
| `vite-plugin-pwa` | Task 10 |
| `VITE_GOOGLE_CLIENT_ID` env var | Task 1 (.env.example), 10 (App.tsx) |
| Supply chain: exact `@react-oauth/google` pin | Task 1 |
| Supply chain: `ignore-scripts=true` preserved | Task 1 (.npmrc) |
| Supply chain: esbuild allowlisted for Vite | Task 1 |

All spec requirements covered.

### Type consistency check

- `TaskStore.addTask(parentId: string, afterId: string | null): string` — used as `store.addTask('root', 'a')` in TaskItem (line matches) and `store.addTask('root', null)` in TaskStore tests ✅
- `TaskStore.outdentTask(id, parentId, grandparentId)` — called as `store.outdentTask(id, parentId, grandparentId)` in TaskItem and Controls ✅
- `findParent(id, tasks): string | null` — used in TaskItem (`findParent(parentId, tasks)`) and Controls (`findParent(focusId, tasks)`) ✅
- `getVisibleOrder(rootId, tasks): string[]` — called with `'root'` as rootId in TaskItem ✅
- `AuthGate` props: `clientId, isAuthenticated, onSignIn, children` — all passed from App.tsx ✅
- `TaskTree` and `Controls` both receive `tasks, store, focusId, onFocusRequest` — matches their prop interfaces ✅
