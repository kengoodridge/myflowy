import { describe, it, expect } from 'vitest';
import { mergeTaskState } from '../merge';
import type { Task, TaskMap } from '../types';

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

describe('mergeTaskState', () => {
  it('keeps a new task added on the other side even though this side touched the shared parent more recently', () => {
    // Remote added "remote1" under root at T1. Local independently touched
    // root (e.g. reordered an unrelated sibling) at T2 > T1, without
    // knowing about remote1 — root's own LWW pick would be local's, which
    // has no idea remote1 exists.
    const localTasks: TaskMap = {
      root: makeTask({ id: 'root', children: ['existing'], updatedAt: '2026-06-02T00:00:00.000Z' }),
      existing: makeTask({ id: 'existing' }),
    };
    const remoteTasks: TaskMap = {
      root: makeTask({ id: 'root', children: ['existing', 'remote1'], updatedAt: '2026-06-01T00:00:00.000Z' }),
      existing: makeTask({ id: 'existing' }),
      remote1: makeTask({ id: 'remote1', text: 'added on another client', updatedAt: '2026-06-01T00:00:00.000Z' }),
    };

    const { tasks } = mergeTaskState(localTasks, {}, remoteTasks, {});

    expect(tasks['remote1']).toBeDefined();
    expect(tasks['root'].children).toContain('remote1');
    expect(tasks['root'].children).toContain('existing');
  });

  it('keeps a new task added locally even though the remote copy of the shared parent is newer', () => {
    const localTasks: TaskMap = {
      root: makeTask({ id: 'root', children: ['local1'], updatedAt: '2026-06-01T00:00:00.000Z' }),
      local1: makeTask({ id: 'local1', text: 'added locally' }),
    };
    const remoteTasks: TaskMap = {
      root: makeTask({ id: 'root', children: [], updatedAt: '2026-06-02T00:00:00.000Z' }),
    };

    const { tasks } = mergeTaskState(localTasks, {}, remoteTasks, {});

    expect(tasks['local1']).toBeDefined();
    expect(tasks['root'].children).toContain('local1');
  });

  it('does not resurrect a deleted child into a stale parent snapshot', () => {
    const localTasks: TaskMap = {
      root: makeTask({ id: 'root', children: [], updatedAt: '2026-06-02T00:00:00.000Z' }),
    };
    const remoteTasks: TaskMap = {
      root: makeTask({ id: 'root', children: ['deleted1'], updatedAt: '2026-06-01T00:00:00.000Z' }),
      deleted1: makeTask({ id: 'deleted1' }),
    };
    const localTombstones = { deleted1: '2026-06-01T12:00:00.000Z' };

    const { tasks } = mergeTaskState(localTasks, localTombstones, remoteTasks, {});

    expect(tasks['deleted1']).toBeUndefined();
    expect(tasks['root'].children).not.toContain('deleted1');
  });

  it('does not duplicate a moved task back into its old parent', () => {
    // Locally, "item" was moved from root to folder1 — both parents were
    // updated together, so both carry the move's timestamp and both win
    // their respective per-id picks over remote's stale (pre-move) copies.
    const localTasks: TaskMap = {
      root: makeTask({ id: 'root', children: ['folder1'], updatedAt: '2026-06-02T00:00:00.000Z' }),
      folder1: makeTask({ id: 'folder1', children: ['item'], updatedAt: '2026-06-02T00:00:00.000Z' }),
      item: makeTask({ id: 'item' }),
    };
    const remoteTasks: TaskMap = {
      root: makeTask({ id: 'root', children: ['folder1', 'item'], updatedAt: '2026-06-01T00:00:00.000Z' }),
      folder1: makeTask({ id: 'folder1', children: [], updatedAt: '2026-06-01T00:00:00.000Z' }),
      item: makeTask({ id: 'item' }),
    };

    const { tasks } = mergeTaskState(localTasks, {}, remoteTasks, {});

    // folder1 (the winning side for that id) already claims "item" — root's
    // reconciliation pass should see that claim and not re-add it.
    const claimants = Object.values(tasks).filter((t) => t.children.includes('item'));
    expect(claimants).toHaveLength(1);
    expect(claimants[0].id).toBe('folder1');
  });

  it('known limitation: a stale-but-timestamp-newer third-party copy of the old parent can still resurrect a moved child', () => {
    // If some other client's copy of "root" is newer than the move itself
    // (e.g. an unrelated edit that hasn't heard about the move yet), root's
    // own per-id pick already re-includes "item" before reconciliation ever
    // runs — reconciliation only adds missing children, it can't retract
    // one the winning snapshot already lists. This would need per-parent
    // assignment timestamps (not just per-task-object timestamps) to fix.
    const localTasks: TaskMap = {
      root: makeTask({ id: 'root', children: ['folder1'], updatedAt: '2026-06-02T00:00:00.000Z' }),
      folder1: makeTask({ id: 'folder1', children: ['item'], updatedAt: '2026-06-02T00:00:00.000Z' }),
      item: makeTask({ id: 'item' }),
    };
    const remoteTasks: TaskMap = {
      root: makeTask({ id: 'root', children: ['folder1', 'item'], updatedAt: '2026-06-03T00:00:00.000Z' }),
      folder1: makeTask({ id: 'folder1', children: [], updatedAt: '2026-06-01T00:00:00.000Z' }),
      item: makeTask({ id: 'item' }),
    };

    const { tasks } = mergeTaskState(localTasks, {}, remoteTasks, {});

    const claimants = Object.values(tasks).filter((t) => t.children.includes('item'));
    expect(claimants.map((t) => t.id).sort()).toEqual(['folder1', 'root']);
  });
});
