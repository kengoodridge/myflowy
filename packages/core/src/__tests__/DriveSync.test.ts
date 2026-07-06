import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setAccessToken } from '../auth';
import type { DriveFile, TaskMap, TombstoneMap } from '../types';

// Mock the driveApi module so DriveSync uses our stubs
vi.mock('../drive/driveApi', () => ({
  findFolder: vi.fn(),
  createFolder: vi.fn(),
  findFile: vi.fn(),
  findFileGlobal: vi.fn(),
  readFile: vi.fn(),
  createFile: vi.fn(),
  updateFile: vi.fn(),
}));

import * as driveApi from '../drive/driveApi';
import { DriveSync } from '../drive/DriveSync';

const mockTasks: TaskMap = {
  root: { id: 'root', text: '', checked: false, pinned: false, collapsed: false, children: [], updatedAt: '2026-01-01T00:00:00Z' },
};
const mockTombstones: TombstoneMap = {};

beforeEach(() => {
  vi.clearAllMocks();
  setAccessToken('tok');
  vi.mocked(driveApi.findFileGlobal).mockResolvedValue(null);
});

describe('DriveSync.read', () => {
  it('returns null when no file exists', async () => {
    vi.mocked(driveApi.findFolder).mockResolvedValue('folder-id');
    vi.mocked(driveApi.findFile).mockResolvedValue(null);

    const sync = new DriveSync();
    expect(await sync.read()).toBeNull();
  });

  it('parses and returns the DriveFile when found', async () => {
    const driveFile: DriveFile = { version: 1, tasks: mockTasks, tombstones: mockTombstones, updatedAt: '2026-01-01T00:00:00Z' };
    vi.mocked(driveApi.findFolder).mockResolvedValue('folder-id');
    vi.mocked(driveApi.findFile).mockResolvedValue('file-id');
    vi.mocked(driveApi.readFile).mockResolvedValue(JSON.stringify(driveFile));

    const sync = new DriveSync();
    expect(await sync.read()).toEqual(driveFile);
  });

  it('defaults tombstones to {} for files written before tombstones existed', async () => {
    const legacyFile = { version: 1, tasks: mockTasks, updatedAt: '2026-01-01T00:00:00Z' };
    vi.mocked(driveApi.findFolder).mockResolvedValue('folder-id');
    vi.mocked(driveApi.findFile).mockResolvedValue('file-id');
    vi.mocked(driveApi.readFile).mockResolvedValue(JSON.stringify(legacyFile));

    const sync = new DriveSync();
    expect(await sync.read()).toEqual({ ...legacyFile, tombstones: {} });
  });
});

describe('DriveSync.read (edge cases)', () => {
  it('returns null when file content is corrupt JSON', async () => {
    vi.mocked(driveApi.findFolder).mockResolvedValue('folder-id');
    vi.mocked(driveApi.findFile).mockResolvedValue('file-id');
    vi.mocked(driveApi.readFile).mockResolvedValue('not-valid-json{{{');

    const sync = new DriveSync();
    expect(await sync.read()).toBeNull();
  });
});

describe('DriveSync.write', () => {
  it('creates the file on first write', async () => {
    vi.mocked(driveApi.findFolder).mockResolvedValue('folder-id');
    vi.mocked(driveApi.findFile).mockResolvedValue(null);
    vi.mocked(driveApi.createFile).mockResolvedValue('new-file-id');

    const sync = new DriveSync();
    await sync.write(mockTasks, mockTombstones);

    expect(driveApi.createFile).toHaveBeenCalledWith(
      'myflowy.json',
      'folder-id',
      expect.stringContaining('"version":1')
    );
    expect(driveApi.updateFile).not.toHaveBeenCalled();
  });

  it('updates the file on subsequent writes', async () => {
    const driveFile: DriveFile = { version: 1, tasks: mockTasks, tombstones: mockTombstones, updatedAt: '2026-01-01T00:00:00Z' };
    vi.mocked(driveApi.findFolder).mockResolvedValue('folder-id');
    vi.mocked(driveApi.findFile).mockResolvedValue('existing-file-id');
    vi.mocked(driveApi.readFile).mockResolvedValue(JSON.stringify(driveFile));

    const sync = new DriveSync();
    await sync.read(); // caches fileId
    await sync.write(mockTasks, mockTombstones);

    expect(driveApi.updateFile).toHaveBeenCalledWith(
      'existing-file-id',
      expect.stringContaining('"version":1')
    );
    expect(driveApi.createFile).not.toHaveBeenCalled();
  });

  it('creates folder when it does not exist', async () => {
    vi.mocked(driveApi.findFolder).mockResolvedValue(null);
    vi.mocked(driveApi.createFolder).mockResolvedValue('new-folder-id');
    vi.mocked(driveApi.findFile).mockResolvedValue(null);
    vi.mocked(driveApi.createFile).mockResolvedValue('new-file-id');

    const sync = new DriveSync();
    await sync.write(mockTasks, mockTombstones);

    expect(driveApi.createFolder).toHaveBeenCalledWith('MyFlowy');
  });

  it('updates when file exists but read() was never called', async () => {
    vi.mocked(driveApi.findFolder).mockResolvedValue('folder-id');
    vi.mocked(driveApi.findFile).mockResolvedValue('existing-file-id');

    const sync = new DriveSync();
    await sync.write(mockTasks, mockTombstones);

    expect(driveApi.updateFile).toHaveBeenCalledWith(
      'existing-file-id',
      expect.stringContaining('"version":1')
    );
    expect(driveApi.createFile).not.toHaveBeenCalled();
  });
});
