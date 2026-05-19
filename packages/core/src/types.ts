export interface Task {
  id: string;
  text: string;
  checked: boolean;
  pinned: boolean;
  collapsed: boolean;
  children: string[];
}

export type TaskMap = Record<string, Task>;

export interface DriveFile {
  version: number;
  tasks: TaskMap;
  updatedAt: string;
}

export interface LocalStore {
  get(id: string): Promise<Task | undefined>;
  set(task: Task): Promise<void>;
  remove(id: string): Promise<void>;
  getAll(): Promise<TaskMap>;
  setAll(tasks: TaskMap): Promise<void>;
  getPendingUpload(): Promise<boolean>;
  setPendingUpload(pending: boolean): Promise<void>;
  getLastSyncedAt(): Promise<string | null>;
  setLastSyncedAt(iso: string): Promise<void>;
}
