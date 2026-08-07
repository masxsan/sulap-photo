// API client sederhana — base '/api' diproxy Vite ke server di dev.
const BASE = '/api';

const TOKEN_KEY = 'sulap_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(method, path, { body, form } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (form) {
    payload = form; // FormData
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const res = await fetch(BASE + path, { method, headers, body: payload });
  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }
  if (!res.ok) {
    const err = new Error(data?.error || `Request gagal (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, { body }),
  patch: (path, body) => request('PATCH', path, { body }),
  upload: (path, file) => {
    const form = new FormData();
    form.append('file', file);
    return request('POST', path, { form });
  },
  // Ambil file hasil dengan auth header, return Blob URL
  async fileUrl(path) {
    const token = getToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(BASE + path, { headers });
    if (!res.ok) throw new Error('Gagal memuat file');
    return URL.createObjectURL(await res.blob());
  },
};
