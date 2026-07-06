export interface Task {
  id: string;
  text: string;
  checked: boolean;
  pinned: boolean;
  collapsed: boolean;
  children: string[];
  /** ISO timestamp of the last edit to this task, used to merge concurrent edits from other clients. */
  updatedAt: string;
}

export type TaskMap = Record<string, Task>;

/** Maps a deleted task's id to the ISO timestamp it was deleted at, so a sync merge can tell a deletion apart from a task the other side just hasn't seen yet. */
export type TombstoneMap = Record<string, string>;

export interface DriveFile {
  version: number;
  tasks: TaskMap;
  tombstones: TombstoneMap;
  updatedAt: string;
}

export interface LocalStore {
  get(id: string): Promise<Task | undefined>;
  set(task: Task): Promise<void>;
  remove(id: string): Promise<void>;
  getAll(): Promise<TaskMap>;
  setAll(tasks: TaskMap): Promise<void>;
  getTombstones(): Promise<TombstoneMap>;
  setTombstones(tombstones: TombstoneMap): Promise<void>;
  getPendingUpload(): Promise<boolean>;
  setPendingUpload(pending: boolean): Promise<void>;
  getLastSyncedAt(): Promise<string | null>;
  setLastSyncedAt(iso: string): Promise<void>;
}
