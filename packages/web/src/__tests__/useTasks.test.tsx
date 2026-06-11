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
    setAuthErrorHandler: vi.fn(),
    setSyncCompleteHandler: vi.fn(),
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
