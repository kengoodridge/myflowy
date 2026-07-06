import { describe, it, expect, vi } from 'vitest';
import type { Task, TaskMap, TombstoneMap, LocalStore } from '../types';
import type { DriveFile } from '../types';

// In-memory LocalStore for testing
class MemoryStore implements LocalStore {
  tasks: TaskMap = {};
  tombstones: TombstoneMap = {};
  private pending = false;
  private syncedAt: string | null = null;

  async get(id: string) { return this.tasks[id]; }
  async set(task: Task) { this.tasks = { ...this.tasks, [task.id]: task }; }
  async remove(id: string) {
    const { [id]: _, ...rest } = this.tasks;
    this.tasks = rest;
    this.tombstones = { ...this.tombstones, [id]: new Date().toISOString() };
  }
  async getAll() { return { ...this.tasks }; }
  async setAll(tasks: TaskMap) { this.tasks = { ...tasks }; }
  async getTombstones() { return { ...this.tombstones }; }
  async setTombstones(t: TombstoneMap) { this.tombstones = { ...t }; }
  async getPendingUpload() { return this.pending; }
  async setPendingUpload(p: boolean) { this.pending = p; }
  async getLastSyncedAt() { return this.syncedAt; }
  async setLastSyncedAt(iso: string) { this.syncedAt = iso; }
}

// Minimal DriveSync mock
class MockDriveSync {
  written: TaskMap | null = null;
  writtenTombstones: TombstoneMap | null = null;
  readResult: DriveFile | null = null;

  async read() { return this.readResult; }
  async write(tasks: TaskMap, tombstones: TombstoneMap) {
    this.written = { ...tasks };
    this.writtenTombstones = { ...tombstones };
  }
}

function makeTask(overrides: Partial<Task> & { id: string }): Task {
  return {
    text: '',
    checked: false,
    pinned: false,
    collapsed: false,
    children: [],
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
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
    store.tasks = { root: makeTask({ id: 'root', text: 'hi' }) };
    const drive = new MockDriveSync();
    const engine = new SyncEngine(store, drive as any);
    const tasks = await engine.initialize();
    expect(tasks['root'].text).toBe('hi');
  });

  it('defaults missing updatedAt on legacy tasks to the epoch', async () => {
    const store = new MemoryStore();
    store.tasks = { root: { id: 'root', text: 'hi', checked: false, pinned: false, collapsed: false, children: [] } as Task };
    const drive = new MockDriveSync();
    const engine = new SyncEngine(store, drive as any);
    const tasks = await engine.initialize();
    expect(tasks['root'].updatedAt).toBe('1970-01-01T00:00:00.000Z');
  });
});

describe('SyncEngine.setTask / removeTask', () => {
  it('writes task to local store', async () => {
    const store = new MemoryStore();
    const drive = new MockDriveSync();
    const engine = new SyncEngine(store, drive as any);
    const task = makeTask({ id: 't1', text: 'A' });
    await engine.setTask(task);
    expect(await store.get('t1')).toEqual(task);
  });

  it('removes task from local store', async () => {
    const store = new MemoryStore();
    const task = makeTask({ id: 't1', text: 'A' });
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
    store.tasks = { root: makeTask({ id: 'root' }) };
    const drive = new MockDriveSync();
    const engine = new SyncEngine(store, drive as any);
    const result = await engine.syncFromDrive();
    expect(result).toBeNull();
    expect(drive.written).toEqual(store.tasks);
    expect(await store.getPendingUpload()).toBe(false);
  });

  it('pulls a task added on another client', async () => {
    const store = new MemoryStore();
    store.tasks = { root: makeTask({ id: 'root', children: [] }) };
    const remoteTasks: TaskMap = {
      root: makeTask({ id: 'root', children: ['remote1'], updatedAt: '2026-06-01T00:00:00.000Z' }),
      remote1: makeTask({ id: 'remote1', text: 'remote', updatedAt: '2026-06-01T00:00:00.000Z' }),
    };
    const drive = new MockDriveSync();
    drive.readResult = { version: 1, tasks: remoteTasks, tombstones: {}, updatedAt: '2026-06-01T00:00:00.000Z' };

    const engine = new SyncEngine(store, drive as any);
    const result = await engine.syncFromDrive();
    expect(result).toEqual(remoteTasks);
    expect(store.tasks).toEqual(remoteTasks);
  });

  it('keeps a newer local edit over a stale remote copy of the same task', async () => {
    const store = new MemoryStore();
    const localTask = makeTask({ id: 't1', text: 'local edit', updatedAt: '2026-06-02T00:00:00.000Z' });
    store.tasks = { root: makeTask({ id: 'root', children: ['t1'] }), t1: localTask };
    const remoteTasks: TaskMap = {
      root: makeTask({ id: 'root', children: ['t1'] }),
      t1: makeTask({ id: 't1', text: 'stale remote', updatedAt: '2026-01-01T00:00:00.000Z' }),
    };
    const drive = new MockDriveSync();
    // Whole-file updatedAt is newer than local's last sync, but the individual task is not.
    drive.readResult = { version: 1, tasks: remoteTasks, tombstones: {}, updatedAt: '2026-07-01T00:00:00.000Z' };

    const engine = new SyncEngine(store, drive as any);
    await engine.syncFromDrive();
    expect(store.tasks['t1'].text).toBe('local edit');
  });

  it('does not discard a local-only task even when the remote file as a whole is newer', async () => {
    const store = new MemoryStore();
    const localOnly = makeTask({ id: 'local1', text: 'not yet synced', updatedAt: '2026-06-05T00:00:00.000Z' });
    store.tasks = { root: makeTask({ id: 'root', children: ['local1'] }), local1: localOnly };
    const remoteTasks: TaskMap = { root: makeTask({ id: 'root', children: [] }) };
    const drive = new MockDriveSync();
    drive.readResult = { version: 1, tasks: remoteTasks, tombstones: {}, updatedAt: '2026-07-01T00:00:00.000Z' };

    const engine = new SyncEngine(store, drive as any);
    await engine.syncFromDrive();
    expect(store.tasks['local1']).toEqual(localOnly);
  });

  it('honors a local deletion over a stale remote copy of the deleted task', async () => {
    const store = new MemoryStore();
    store.tasks = { root: makeTask({ id: 'root', children: [] }) };
    store.tombstones = { t1: '2026-06-01T00:00:00.000Z' };
    const remoteTasks: TaskMap = {
      root: makeTask({ id: 'root', children: ['t1'] }),
      t1: makeTask({ id: 't1', text: 'still there remotely', updatedAt: '2026-01-01T00:00:00.000Z' }),
    };
    const drive = new MockDriveSync();
    drive.readResult = { version: 1, tasks: remoteTasks, tombstones: {}, updatedAt: '2026-01-01T00:00:00.000Z' };

    const engine = new SyncEngine(store, drive as any);
    await engine.syncFromDrive();
    expect(store.tasks['t1']).toBeUndefined();
  });

  it('resurrects a task deleted locally if the remote edit happened after the deletion', async () => {
    const store = new MemoryStore();
    store.tasks = { root: makeTask({ id: 'root', children: [] }) };
    store.tombstones = { t1: '2026-01-01T00:00:00.000Z' };
    const remoteTasks: TaskMap = {
      root: makeTask({ id: 'root', children: ['t1'] }),
      t1: makeTask({ id: 't1', text: 'edited after deletion', updatedAt: '2026-06-01T00:00:00.000Z' }),
    };
    const drive = new MockDriveSync();
    drive.readResult = { version: 1, tasks: remoteTasks, tombstones: {}, updatedAt: '2026-06-01T00:00:00.000Z' };

    const engine = new SyncEngine(store, drive as any);
    await engine.syncFromDrive();
    expect(store.tasks['t1']?.text).toBe('edited after deletion');
  });

  it('returns null (no-op) when nothing changes', async () => {
    const store = new MemoryStore();
    store.tasks = { root: makeTask({ id: 'root' }) };
    const drive = new MockDriveSync();
    drive.readResult = { version: 1, tasks: { root: makeTask({ id: 'root' }) }, tombstones: {}, updatedAt: '2026-01-01T00:00:00.000Z' };

    const engine = new SyncEngine(store, drive as any);
    const result = await engine.syncFromDrive();
    expect(result).toBeNull();
  });
});

describe('SyncEngine.onNetworkRestore', () => {
  it('flushes to Drive when pendingUpload is true', async () => {
    const store = new MemoryStore();
    await store.setPendingUpload(true);
    store.tasks = { root: makeTask({ id: 'root' }) };
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
    store.tasks = { root: makeTask({ id: 'root' }) };
    const drive = new MockDriveSync();
    const engine = new SyncEngine(store, drive as any);
    await engine.flushToDrive();
    expect(drive.written).toEqual(store.tasks);
    expect(await store.getPendingUpload()).toBe(false);
  });

  it('merges with remote before pushing, instead of clobbering a concurrent remote edit', async () => {
    const store = new MemoryStore();
    store.tasks = {
      root: makeTask({ id: 'root', children: ['remote1'] }),
      remote1: makeTask({ id: 'remote1', text: 'seen locally, unedited', updatedAt: '2026-01-01T00:00:00.000Z' }),
    };
    const drive = new MockDriveSync();
    drive.readResult = {
      version: 1,
      tasks: {
        root: makeTask({ id: 'root', children: ['remote1'] }),
        remote1: makeTask({ id: 'remote1', text: 'edited by another client', updatedAt: '2026-06-01T00:00:00.000Z' }),
      },
      tombstones: {},
      updatedAt: '2026-06-01T00:00:00.000Z',
    };
    const engine = new SyncEngine(store, drive as any);
    await engine.flushToDrive();
    expect(drive.written?.remote1.text).toBe('edited by another client');
    expect(store.tasks['remote1'].text).toBe('edited by another client');
  });
});

describe('SyncEngine.scheduleDriveUpload (failure path)', () => {
  it('sets pendingUpload=true when Drive flush fails', async () => {
    const store = new MemoryStore();
    const drive = new MockDriveSync();
    const engine = new SyncEngine(store, drive as any);

    // Make drive.write throw
    drive.write = async () => { throw new Error('Network error'); };

    const task = makeTask({ id: 't1', text: 'A' });
    await engine.setTask(task);

    // Wait for the debounce timer to fire (500ms)
    await vi.waitFor(async () => {
      expect(await store.getPendingUpload()).toBe(true);
    }, { timeout: 1000 });

    engine.destroy();
  });
});
