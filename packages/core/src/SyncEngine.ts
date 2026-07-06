import type { Task, TaskMap, TombstoneMap, LocalStore, DriveFile } from './types';
import { DriveSync } from './drive/DriveSync';
import { AuthError } from './drive/driveApi';
import { initialRoot } from './utils';
import { mergeTaskState, isSameTaskMap } from './merge';

// Legacy per-task data (written before per-task timestamps existed) has no
// updatedAt — treat it as the oldest possible edit so any real edit wins.
const EPOCH = '1970-01-01T00:00:00.000Z';

function normalizeTasks(tasks: TaskMap): TaskMap {
  const result: TaskMap = {};
  for (const [id, task] of Object.entries(tasks)) {
    result[id] = task.updatedAt ? task : { ...task, updatedAt: EPOCH };
  }
  return result;
}

export class SyncEngine {
  private store: LocalStore;
  private drive: DriveSync;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly DEBOUNCE_MS = 500;
  private onAuthError?: () => void;
  private onSyncComplete?: (err?: Error, fileUrl?: string | null) => void;

  constructor(store: LocalStore, drive?: DriveSync) {
    this.store = store;
    this.drive = drive ?? new DriveSync();
  }

  setAuthErrorHandler(handler: () => void): void {
    this.onAuthError = handler;
  }

  setSyncCompleteHandler(handler: (err?: Error, fileUrl?: string | null) => void): void {
    this.onSyncComplete = handler;
  }

  async initialize(): Promise<TaskMap> {
    const tasks = await this.store.getAll();
    if (!tasks['root']) {
      const root = initialRoot();
      await this.store.set(root);
      return { root };
    }
    return normalizeTasks(tasks);
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

  /**
   * Reads whatever is on Drive and merges it with local state on a per-task,
   * last-write-wins basis (see mergeTaskState) instead of comparing a single
   * file-level timestamp — that used to let one client's whole snapshot
   * silently overwrite another client's concurrent edits.
   */
  private async mergeWithRemote(): Promise<{
    tasks: TaskMap;
    tombstones: TombstoneMap;
    remote: DriveFile | null;
    changed: boolean;
  }> {
    const remote = await this.drive.read();
    const localTasks = normalizeTasks(await this.store.getAll());
    const localTombstones = await this.store.getTombstones();

    if (!remote) {
      return { tasks: localTasks, tombstones: localTombstones, remote: null, changed: false };
    }

    const remoteTasks = normalizeTasks(remote.tasks);
    const remoteTombstones = remote.tombstones ?? {};
    const { tasks, tombstones } = mergeTaskState(localTasks, localTombstones, remoteTasks, remoteTombstones);
    const changed = !isSameTaskMap(localTasks, tasks);

    if (changed) await this.store.setAll(tasks);
    await this.store.setTombstones(tombstones);

    return { tasks, tombstones, remote, changed };
  }

  async syncFromDrive(): Promise<TaskMap | null> {
    const { tasks, tombstones, remote, changed } = await this.mergeWithRemote();
    if (!remote) {
      await this.drive.write(tasks, tombstones);
    }
    await this.store.setLastSyncedAt(new Date().toISOString());
    await this.store.setPendingUpload(false);
    return changed ? tasks : null;
  }

  async flushToDrive(): Promise<void> {
    // Merge with whatever is currently on Drive before pushing, so this
    // client's local edits are combined with any other client's changes
    // instead of overwriting them outright.
    const { tasks, tombstones } = await this.mergeWithRemote();
    await this.drive.write(tasks, tombstones);
    await this.store.setLastSyncedAt(new Date().toISOString());
    await this.store.setPendingUpload(false);
  }

  async onNetworkRestore(): Promise<void> {
    const pending = await this.store.getPendingUpload();
    if (pending) await this.flushToDrive();
  }

  destroy(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  private scheduleDriveUpload(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(async () => {
      try {
        await this.flushToDrive();
        this.onSyncComplete?.(undefined, this.drive.getFileUrl());
      } catch (err) {
        if (err instanceof AuthError) {
          this.onAuthError?.();
          return;
        }
        const error = err instanceof Error ? err : new Error(String(err));
        console.error('[SyncEngine] Drive upload failed, queuing for retry:', error);
        await this.store.setPendingUpload(true);
        this.onSyncComplete?.(error);
      }
    }, this.DEBOUNCE_MS);
  }
}
