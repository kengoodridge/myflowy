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
