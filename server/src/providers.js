// Provider AI. Setiap provider mengekspor generate({ feature, prompt, images, ratio, model, config })
// yang mengembalikan Buffer gambar.
const config = require('./config');

function ratioSize(ratio, { forOpenAI = false } = {}) {
  const r = ratio || '1:1';
  const mapOpenAI = {
    '1:1': '1024x1024',
    '16:9': '1280x720',
    '9:16': '720x1280',
    '4:3': '1024x768',
    '3:4': '768x1024',
    '3:2': '1152x768',
    '2:3': '768x1152',
  };
  const mapPx = {
    '1:1': [1024, 1024],
    '16:9': [1280, 720],
    '9:16': [720, 1280],
    '4:3': [1024, 768],
    '3:4': [768, 1024],
    '3:2': [1152, 768],
    '2:3': [768, 1152],
  };
  if (forOpenAI) return mapOpenAI[r] || mapOpenAI['1:1'];
  return mapPx[r] || mapPx['1:1'];
}

async function pollinations({ prompt, ratio, model }) {
  const [w, h] = ratioSize(ratio);
  const m = model || config.pollinationsModel;
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(
    prompt
  )}?width=${w}&height=${h}&nologo=true&model=${m}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 120000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { accept: 'image/*' },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Pollinations gagal (${res.status}): ${text.slice(0, 200)}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 100) throw new Error('Pollinations mengembalikan gambar kosong');
    return buf;
  } finally {
    clearTimeout(timer);
  }
}

// Kode error jaringan sementara yang layak di-retry
const RETRYABLE_NET = ['UND_ERR_SOCKET', 'ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EPIPE', 'ENETUNREACH', 'EHOSTUNREACH'];

// fetch dengan pesan error ramah bila koneksi gagal (DNS, timeout, TLS, dsb.)
// dan retry otomatis untuk kegagalan jaringan sementara.
async function pFetch(url, init, { retries = 3 } = {}) {
  let lastErr = null;
  for (let i = 0; i < retries; i++) {
    try {
      return await fetch(url, init);
    } catch (err) {
      lastErr = err;
      const code = String(err?.cause?.code || err?.code || err?.message || '').toUpperCase();
      const retryable =
        RETRYABLE_NET.some((c) => code.includes(c)) ||
        /FETCH FAILED|SOCKET|ECONNRESET|ETIMEDOUT|UND_ERR/i.test(code);
      if (!retryable || i === retries - 1) break;
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  const cause = lastErr?.cause?.code || lastErr?.cause?.message || lastErr?.message || 'kesalahan tak dikenal';
  const friendly = /ByteString/.test(cause)
    ? 'API key atau Base URL mengandung karakter non-ASCII (mis. tanda pisah "—"). Hapus dan ketik ulang secara manual.'
    : cause;
  const e = new Error(
    `Gagal terhubung ke provider (${url}): ${friendly}. Cek koneksi internet, proxy/VPN, atau firewall Anda, lalu coba lagi.`
  );
  e.status = 502;
  throw e;
}

// Coba request, lalu retry TANPA `response_format` bila provider menolak parameter itu.
async function fetchRetry(fn, ctrl) {
  let res = await fn(true);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (res.status === 400 && /response_format/i.test(text)) {
      res = await fn(false);
      if (res.ok) return res;
      const text2 = await res.text().catch(() => '');
      throw new Error(`API gambar gagal (${res.status}): ${text2.slice(0, 200)}`);
    }
    throw new Error(`API gambar gagal (${res.status}): ${text.slice(0, 200)}`);
  }
  return res;
}

// Normalisasi base URL: default bila kosong, tambah protokol bila tak ada, buang slash di akhir.
function normalizeBase(url, fallback = '') {
  const s = String(url || fallback || '').trim().replace(/\/+$/, '');
  if (!s) return String(fallback || '').trim().replace(/\/+$/, '');
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

async function openaiCompat({ feature, prompt, images, ratio, model, apiKey, baseUrl }) {
  const base = normalizeBase(baseUrl, config.openaiBaseUrl);
  const m = model || config.openaiModel;
  const size = ratioSize(ratio, { forOpenAI: true });
  const headers = {
    Authorization: `Bearer ${apiKey}`,
  };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 180000);

  try {
    let data;
    if (feature.type === 'img2img') {
      // /images/edits (multipart)
      const img = images[0];
      const form = (withFormat) => {
        const f = new FormData();
        f.append('image', new Blob([img.buffer], { type: img.mime || 'image/png' }), 'input.png');
        f.append('prompt', prompt);
        f.append('model', m);
        f.append('size', size);
        f.append('n', '1');
        if (withFormat) f.append('response_format', 'b64_json');
        return f;
      };
      const res = await fetchRetry(
        (withFormat) => pFetch(`${base}/images/edits`, { method: 'POST', headers, body: form(withFormat), signal: ctrl.signal }),
        ctrl
      );
      data = await res.json();
    } else {
      // /images/generations (json)
      const body = (withFormat) =>
        JSON.stringify({
          model: m,
          prompt,
          size,
          n: 1,
          ...(withFormat ? { response_format: 'b64_json' } : {}),
        });
      const res = await fetchRetry(
        (withFormat) =>
          pFetch(`${base}/images/generations`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: body(withFormat),
            signal: ctrl.signal,
          }),
        ctrl
      );
      data = await res.json();
    }

    const item = data?.data?.[0];
    if (!item) throw new Error('Provider tidak mengembalikan hasil gambar');
    if (item.b64_json) return Buffer.from(item.b64_json, 'base64');
    if (item.url) {
      const r = await fetch(item.url, { signal: ctrl.signal });
      if (!r.ok) throw new Error('Gagal mengunduh hasil dari provider');
      return Buffer.from(await r.arrayBuffer());
    }
    throw new Error('Format hasil provider tidak dikenali');
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { pollinations, openaiCompat, ratioSize, normalizeBase };

