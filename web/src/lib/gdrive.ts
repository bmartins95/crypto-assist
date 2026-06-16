export const GDRIVE_FILE_NAME = 'carteira-crypto-backup.json';
export const GDRIVE_CONFIG_NAME = 'carteira-crypto-config.json';

async function driveReq(url: string, token: string, opts: RequestInit = {}): Promise<Response> {
  const r = await fetch(url, {
    ...opts,
    headers: { Authorization: 'Bearer ' + token, ...(opts.headers as Record<string, string> || {}) },
  });
  if (r.status === 401) throw Object.assign(new Error('token_expired'), { status: 401 });
  return r;
}

export async function driveFindFile(name: string, token: string): Promise<string | null> {
  const q = encodeURIComponent(`name='${name}' and trashed=false`);
  const r = await driveReq(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)&spaces=drive`, token);
  const d = await r.json();
  return d.files?.[0]?.id || null;
}

export async function driveUpload(name: string, payload: string, token: string, existingId?: string | null): Promise<string> {
  const meta = JSON.stringify({ name, mimeType: 'application/json' });
  const form = new FormData();
  form.append('metadata', new Blob([meta], { type: 'application/json' }));
  form.append('file', new Blob([payload], { type: 'application/json' }));
  const url = existingId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
  const r = await driveReq(url, token, { method: existingId ? 'PATCH' : 'POST', body: form });
  const d = await r.json();
  return d.id || existingId || '';
}

export async function driveDownload<T>(fileId: string, token: string): Promise<T> {
  const r = await driveReq(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, token);
  return r.json();
}
