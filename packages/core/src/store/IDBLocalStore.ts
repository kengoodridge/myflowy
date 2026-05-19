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
