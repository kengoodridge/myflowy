import type { DriveFile, TaskMap, TombstoneMap } from '../types';
import { findFolder, createFolder, findFile, findFileGlobal, readFile, createFile, updateFile } from './driveApi';

const FOLDER_NAME = 'MyFlowy';
const FILE_NAME = 'myflowy.json';
const FILE_VERSION = 1;

export class DriveSync {
  private folderId: string | null = null;
  private fileId: string | null = null;

  private async ensureFolder(): Promise<string> {
    if (this.folderId) return this.folderId;
    this.folderId = await findFolder(FOLDER_NAME);
    if (!this.folderId) this.folderId = await createFolder(FOLDER_NAME);
    return this.folderId;
  }

  async read(): Promise<DriveFile | null> {
    // Search globally by name first — avoids creating duplicate folders across sessions
    const global = await findFileGlobal(FILE_NAME);
    if (global) {
      this.fileId = global.id;
      this.folderId = global.parentId;
      console.log('[DriveSync] read — found globally, folderId:', this.folderId, 'fileId:', this.fileId);
    } else {
      const folderId = await this.ensureFolder();
      this.fileId = await findFile(FILE_NAME, folderId);
      console.log('[DriveSync] read — folderId:', folderId, 'fileId:', this.fileId);
    }
    if (!this.fileId) return null;
    const raw = await readFile(this.fileId);
    let data: DriveFile;
    try {
      data = JSON.parse(raw) as DriveFile;
    } catch {
      return null;
    }
    if (data.version !== FILE_VERSION) {
      throw new Error(`Unsupported DriveFile version: ${data.version}`);
    }
    // Older files predate per-task tombstones — default to none.
    return { ...data, tombstones: data.tombstones ?? {} };
  }

  getFileUrl(): string | null {
    return this.fileId ? `https://drive.google.com/file/d/${this.fileId}/view` : null;
  }

  async write(tasks: TaskMap, tombstones: TombstoneMap): Promise<void> {
    // Prefer global lookup over folder-scoped to avoid duplicate file creation
    if (!this.fileId) {
      const global = await findFileGlobal(FILE_NAME);
      if (global) {
        this.fileId = global.id;
        this.folderId = global.parentId;
      }
    }
    const folderId = await this.ensureFolder();
    const cachedFileId = this.fileId;
    if (!this.fileId) {
      this.fileId = await findFile(FILE_NAME, folderId);
    }
    const file: DriveFile = {
      version: FILE_VERSION,
      tasks,
      tombstones,
      updatedAt: new Date().toISOString(),
    };
    const content = JSON.stringify(file);
    const taskCount = Object.keys(tasks).length;
    if (this.fileId) {
      console.log('[DriveSync] write — updateFile', this.fileId, `(cached=${!!cachedFileId}, tasks=${taskCount}, bytes=${content.length})`);
      await updateFile(this.fileId, content);
    } else {
      console.log('[DriveSync] write — createFile in folder', folderId, `(tasks=${taskCount}, bytes=${content.length})`);
      this.fileId = await createFile(FILE_NAME, folderId, content);
      console.log('[DriveSync] write — created fileId:', this.fileId);
    }
  }
}
