import { get, set, del, keys, entries, delMany, setMany } from 'idb-keyval';
import type { Task, TaskMap, TombstoneMap, LocalStore } from '../types';

const PENDING_KEY = '__pending__';
const SYNCED_AT_KEY = '__synced_at__';
const TOMBSTONES_KEY = '__tombstones__';
const META_KEYS = new Set([PENDING_KEY, SYNCED_AT_KEY, TOMBSTONES_KEY]);

export class IDBLocalStore implements LocalStore {
  async get(id: string): Promise<Task | undefined> {
    return get<Task>(id);
  }

  async set(task: Task): Promise<void> {
    await set(task.id, task);
  }

  async remove(id: string): Promise<void> {
    await del(id);
    const tombstones = await this.getTombstones();
    await this.setTombstones({ ...tombstones, [id]: new Date().toISOString() });
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
    const existing = await keys<string>();
    const taskKeys = existing.filter((k) => !META_KEYS.has(k));
    if (taskKeys.length > 0) await delMany(taskKeys);
    const entries = Object.entries(tasks) as [string, Task][];
    if (entries.length > 0) await setMany(entries);
  }

  async getTombstones(): Promise<TombstoneMap> {
    return (await get<TombstoneMap>(TOMBSTONES_KEY)) ?? {};
  }

  async setTombstones(tombstones: TombstoneMap): Promise<void> {
    await set(TOMBSTONES_KEY, tombstones);
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
