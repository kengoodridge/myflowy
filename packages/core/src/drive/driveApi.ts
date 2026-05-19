import { getAccessToken } from '../auth';

const BASE = 'https://www.googleapis.com';

function authHeader(): string {
  const token = getAccessToken();
  if (!token) throw new Error('No access token set — call setAccessToken() first');
  return `Bearer ${token}`;
}

function escapeDriveString(s: string): string {
  return s.replace(/'/g, "\\'");
}

async function checkOk(res: Response): Promise<void> {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Drive API ${res.status}: ${body}`);
  }
}

export async function findFolder(name: string): Promise<string | null> {
  const q = encodeURIComponent(
    `name='${escapeDriveString(name)}' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`
  );
  const res = await fetch(`${BASE}/drive/v3/files?q=${q}&fields=files(id)`, {
    headers: { Authorization: authHeader() },
  });
  await checkOk(res);
  const data = await res.json();
  return data.files?.[0]?.id ?? null;
}

export async function createFolder(name: string): Promise<string> {
  const res = await fetch(`${BASE}/drive/v3/files`, {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: ['root'],
    }),
  });
  await checkOk(res);
  const data = await res.json();
  return data.id;
}

export async function findFile(name: string, parentId: string): Promise<string | null> {
  const q = encodeURIComponent(
    `name='${escapeDriveString(name)}' and '${parentId}' in parents and trashed=false`
  );
  const res = await fetch(`${BASE}/drive/v3/files?q=${q}&fields=files(id)`, {
    headers: { Authorization: authHeader() },
  });
  await checkOk(res);
  const data = await res.json();
  return data.files?.[0]?.id ?? null;
}

export async function readFile(fileId: string): Promise<string> {
  const res = await fetch(`${BASE}/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: authHeader() },
  });
  await checkOk(res);
  return res.text();
}

export async function createFile(
  name: string,
  parentId: string,
  content: string
): Promise<string> {
  const metadata = JSON.stringify({ name, parents: [parentId] });
  const body = new FormData();
  body.append('metadata', new Blob([metadata], { type: 'application/json' }));
  body.append('media', new Blob([content], { type: 'application/json' }));
  const res = await fetch(`${BASE}/upload/drive/v3/files?uploadType=multipart`, {
    method: 'POST',
    headers: { Authorization: authHeader() },
    body,
  });
  await checkOk(res);
  const data = await res.json();
  return data.id;
}

export async function updateFile(fileId: string, content: string): Promise<void> {
  const res = await fetch(`${BASE}/upload/drive/v3/files/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: content,
  });
  await checkOk(res);
}
