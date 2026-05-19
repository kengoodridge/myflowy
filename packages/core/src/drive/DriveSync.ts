import type { DriveFile, TaskMap } from '../types';
import { findFolder, createFolder, findFile, readFile, createFile, updateFile } from './driveApi';

const FOLDER_NAME = 'MyFlowy';
const FILE_NAME = 'myflowy.json';

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
    const folderId = await this.ensureFolder();
    this.fileId = await findFile(FILE_NAME, folderId);
    if (!this.fileId) return null;
    const raw = await readFile(this.fileId);
    return JSON.parse(raw) as DriveFile;
  }

  async write(tasks: TaskMap): Promise<void> {
    const folderId = await this.ensureFolder();
    if (!this.fileId) {
      this.fileId = await findFile(FILE_NAME, folderId);
    }
    const file: DriveFile = {
      version: 1,
      tasks,
      updatedAt: new Date().toISOString(),
    };
    const content = JSON.stringify(file);
    if (this.fileId) {
      await updateFile(this.fileId, content);
    } else {
      this.fileId = await createFile(FILE_NAME, folderId, content);
    }
  }
}
