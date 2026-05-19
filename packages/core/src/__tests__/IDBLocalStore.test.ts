import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { clear } from 'idb-keyval';
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

  beforeEach(async () => {
    await clear();
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

  it('setAll preserves metadata', async () => {
    await store.setPendingUpload(true);
    await store.setLastSyncedAt('2026-01-01T00:00:00.000Z');
    const newTask: Task = { ...task, id: 'task-2', text: 'World' };
    await store.setAll({ 'task-2': newTask });
    expect(await store.getPendingUpload()).toBe(true);
    expect(await store.getLastSyncedAt()).toBe('2026-01-01T00:00:00.000Z');
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
