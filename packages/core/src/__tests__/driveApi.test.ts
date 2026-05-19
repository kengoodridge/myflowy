import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setAccessToken, clearAccessToken } from '../auth';

// driveApi uses the fetch global — stub it before importing
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

import { findFolder, createFolder, findFile, readFile, createFile, updateFile } from '../drive/driveApi';

beforeEach(() => {
  vi.clearAllMocks();
  setAccessToken('test-token');
});

afterEach(() => {
  clearAccessToken();
});

describe('findFolder', () => {
  it('returns folder id when found', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ files: [{ id: 'folder-123' }] }),
    });
    expect(await findFolder('MyFlowy')).toBe('folder-123');
  });

  it('returns null when not found', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ files: [] }),
    });
    expect(await findFolder('MyFlowy')).toBeNull();
  });
});

describe('createFolder', () => {
  it('returns new folder id', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'new-folder-id' }),
    });
    expect(await createFolder('MyFlowy')).toBe('new-folder-id');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/drive/v3/files'),
      expect.objectContaining({ method: 'POST' })
    );
  });
});

describe('findFile', () => {
  it('returns file id when found', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ files: [{ id: 'file-456' }] }),
    });
    expect(await findFile('myflowy.json', 'folder-123')).toBe('file-456');
  });

  it('returns null when not found', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ files: [] }),
    });
    expect(await findFile('myflowy.json', 'folder-123')).toBeNull();
  });
});

describe('readFile', () => {
  it('returns file text content', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('{"version":1}') });
    expect(await readFile('file-456')).toBe('{"version":1}');
  });
});

describe('updateFile', () => {
  it('calls PATCH with content', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true });
    await updateFile('file-456', '{"version":1}');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('file-456'),
      expect.objectContaining({ method: 'PATCH', body: '{"version":1}' })
    );
  });
});

describe('createFile', () => {
  it('posts multipart upload and returns new file id', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'new-file-id' }),
    });
    expect(await createFile('myflowy.json', 'folder-123', '{"version":1}')).toBe('new-file-id');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('uploadType=multipart'),
      expect.objectContaining({ method: 'POST' })
    );
  });
});
