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

describe('SyncEngine.scheduleDriveUpload (failure path)', () => {
  it('sets pendingUpload=true when Drive flush fails', async () => {
    const store = new MemoryStore();
    const drive = new MockDriveSync();
    const engine = new SyncEngine(store, drive as any);

    // Make drive.write throw
    drive.write = async () => { throw new Error('Network error'); };

    const task: Task = { id: 't1', text: 'A', checked: false, pinned: false, collapsed: false, children: [] };
    await engine.setTask(task);

    // Wait for the debounce timer to fire (500ms)
    await vi.waitFor(async () => {
      expect(await store.getPendingUpload()).toBe(true);
    }, { timeout: 1000 });

    engine.destroy();
  });
});
