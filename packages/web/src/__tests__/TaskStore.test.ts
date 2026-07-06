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
    setAuthErrorHandler: vi.fn(),
    setSyncCompleteHandler: vi.fn(),
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
      const remoteTask: Task = { id: 'remote1', text: 'from drive', checked: false, pinned: false, collapsed: false, children: [], updatedAt: '2026-01-01T00:00:00.000Z' };
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
