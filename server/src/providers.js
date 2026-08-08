// Registry provider AI. Setiap provider adalah adapter yang tahu:
//  - base URL default
//  - cara autentikasi (Bearer / x-goog-api-key / tanpa key)
//  - format request & response (generateContent / images.generations / pollinations)
//  - daftar model
//  - cara men-test koneksi
// Tambah provider baru cukup dengan menambahkan objek di `registry` di bawah.

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
    `Gagal terhubung ke provider: ${friendly}. Cek koneksi internet, proxy/VPN, atau firewall Anda, lalu coba lagi.`
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

// ---------- Adapter: Pollinations (gratis, txt2img) ----------

async function pollinations({ prompt, ratio, model }) {
  const [w, h] = ratioSize(ratio);
  const m = model || config.pollinationsModel;
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(
    prompt
  )}?width=${w}&height=${h}&nologo=true&model=${m}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 120000);
  try {
    const res = await pFetch(url, {
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

async function testPollinations() {
  return { ok: true, url: 'https://image.pollinations.ai', status: 200, message: 'Pollinations aktif (gratis, tanpa API key).' };
}

// ---------- Adapter: OpenAI / OpenAI-compatible ----------

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

async function testOpenAI({ apiKey, baseUrl }) {
  const base = normalizeBase(baseUrl, config.openaiBaseUrl);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(`${base}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: ctrl.signal,
    });
    const text = await r.text().catch(() => '');
    if (r.ok) return { ok: true, url: base, status: r.status, message: `Koneksi OK ke ${base}.` };
    if (r.status === 401 || r.status === 403) {
      return { ok: false, url: base, status: r.status, message: `OpenAI API Key tidak valid (${r.status}). Pastikan key benar & masih aktif.` };
    }
    if (r.status === 404) {
      return { ok: false, url: base, status: r.status, message: 'Model tidak tersedia untuk OpenAI. Periksa nama model.' };
    }
    return { ok: false, url: base, status: r.status, message: `Server ${base} merespons (${r.status}): ${text.slice(0, 160)}` };
  } catch (err) {
    const cause = err?.cause?.code || err?.cause?.message || err?.message || 'kesalahan tak dikenal';
    return { ok: false, url: base, message: `Gagal terhubung ke ${base}: ${cause}. Cek Base URL & koneksi internet.` };
  } finally {
    clearTimeout(timer);
  }
}

// ---------- Adapter: Google Gemini (generativelanguage.googleapis.com) ----------

const GEMINI_DEFAULT_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_MODELS = [
  'gemini-2.0-flash-exp-image-generation',
  'gemini-2.0-flash-preview-image-generation',
  'gemini-2.5-flash-image-preview',
];

async function geminiGenerate({ feature, prompt, images, ratio, model, apiKey, baseUrl }) {
  const base = normalizeBase(baseUrl, config.geminiBaseUrl);
  const m = model || config.geminiModel || GEMINI_MODELS[0];

  const parts = [];
  for (const img of images || []) {
    parts.push({
      inlineData: {
        mimeType: img.mime || 'image/png',
        data: Buffer.from(img.buffer).toString('base64'),
      },
    });
  }
  parts.push({ text: prompt });

  const body = {
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ['IMAGE'],
    },
  };
  if (ratio && ratio !== '1:1') {
    body.generationConfig.aspectRatio = ratio; // 4:3, 3:4, 16:9, 9:16
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 180000);
  try {
    const res = await pFetch(`${base}/models/${encodeURIComponent(m)}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text().catch(() => '');
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      /* bukan JSON */
    }

    if (!res.ok) {
      const apiMsg = data?.error?.message || text.slice(0, 200);
      if (res.status === 401 || res.status === 403) {
        throw new Error(`Google Gemini API Key tidak valid (${res.status}). Pastikan key benar & masih aktif.`);
      }
      if (res.status === 404) {
        throw new Error(`Model tidak tersedia untuk Google Gemini: ${m}. Pilih model lain.`);
      }
      throw new Error(`Google Gemini error (${res.status}): ${apiMsg}`);
    }

    const candidate = data?.candidates?.[0];
    const partsOut = candidate?.content?.parts || [];
    const imgPart = partsOut.find((p) => p.inlineData?.data);
    if (imgPart?.inlineData?.data) {
      return Buffer.from(imgPart.inlineData.data, 'base64');
    }
    // Gemini bisa menolak permintaan gambar di beberapa model
    const finish = candidate?.finishReason || '';
    if (finish) {
      throw new Error(`Google Gemini menolak permintaan (${finish}). Pastikan model mendukung pembuatan gambar.`);
    }
    throw new Error('Google Gemini tidak mengembalikan gambar. Periksa model & kredit API.');
  } finally {
    clearTimeout(timer);
  }
}

async function testGemini({ apiKey, baseUrl }) {
  const base = normalizeBase(baseUrl, config.geminiBaseUrl);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(`${base}/models`, {
      headers: { 'x-goog-api-key': apiKey },
      signal: ctrl.signal,
    });
    const text = await r.text().catch(() => '');
    if (r.ok) return { ok: true, url: base, status: r.status, message: `Koneksi OK ke Google Gemini (${base}).` };
    if (r.status === 401 || r.status === 403) {
      return { ok: false, url: base, status: r.status, message: `Google Gemini API Key tidak valid (${r.status}). Pastikan key benar & masih aktif.` };
    }
    return { ok: false, url: base, status: r.status, message: `Google Gemini merespons (${r.status}): ${text.slice(0, 160)}` };
  } catch (err) {
    const cause = err?.cause?.code || err?.cause?.message || err?.message || 'kesalahan tak dikenal';
    return { ok: false, url: base, message: `Gagal terhubung ke ${base}: ${cause}. Cek Base URL & koneksi internet.` };
  } finally {
    clearTimeout(timer);
  }
}

// ---------- Registry ----------

const registry = {
  pollinations: {
    id: 'pollinations',
    name: 'Pollinations (Gratis)',
    description: 'Gratis tanpa API key. Hanya mendukung fitur berbasis teks (txt2img).',
    requiresApiKey: false,
    supportsImg2img: false,
    defaultBaseUrl: 'https://image.pollinations.ai',
    defaultModel: config.pollinationsModel,
    models: ['flux', 'turbo'],
    generate: pollinations,
    test: testPollinations,
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    description: 'OpenAI atau API serupa (OpenAI-compatible). Mendukung txt2img & img2img.',
    requiresApiKey: true,
    supportsImg2img: true,
    defaultBaseUrl: config.openaiBaseUrl,
    defaultModel: config.openaiModel,
    models: ['gpt-image-1', 'dall-e-3'],
    generate: openaiCompat,
    test: testOpenAI,
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Google AI Studio (generativelanguage.googleapis.com). Autentikasi via x-goog-api-key.',
    requiresApiKey: true,
    supportsImg2img: true,
    defaultBaseUrl: config.geminiBaseUrl,
    defaultModel: config.geminiModel || GEMINI_MODELS[0],
    models: GEMINI_MODELS,
    generate: geminiGenerate,
    test: testGemini,
  },
};

function getProvider(id) {
  return registry[id] || null;
}

function listProviders() {
  return Object.values(registry).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    requiresApiKey: p.requiresApiKey,
    supportsImg2img: p.supportsImg2img,
    defaultBaseUrl: p.defaultBaseUrl,
    defaultModel: p.defaultModel,
    models: p.models,
  }));
}

// Pilih adapter yang benar untuk provider terpilih + konfigurasi user.
// Mengembalikan { name, apiKey, baseUrl, model, generate, test } atau { name: 'unavailable' }.
function resolveProvider(feature, user) {
  const userKey = user.provider_key || '';
  const serverKey = config.openaiApiKey;
  const providerId = user.provider || config.defaultProvider;
  const providerEnabled = user.provider_enabled !== 0;

  // Pollinations gratis untuk fitur teks bila diaktifkan
  if (feature.type !== 'img2img' && user.use_free_txt) {
    return { name: 'pollinations', generate: pollinations, apiKey: '', baseUrl: '', model: config.pollinationsModel };
  }

  // Provider user (harus aktif + punya key)
  if (providerEnabled && userKey) {
    const p = getProvider(providerId);
    if (p) {
      return {
        name: p.id,
        generate: p.generate,
        apiKey: userKey,
        baseUrl: user.provider_base_url || p.defaultBaseUrl,
        model: user.provider_model || p.defaultModel,
      };
    }
  }

  // img2img butuh provider berkey; fallback ke key server OpenAI bila ada
  if (feature.type === 'img2img') {
    if (serverKey) {
      const p = getProvider('openai');
      return { name: 'openai', generate: p.generate, apiKey: serverKey, baseUrl: config.openaiBaseUrl, model: config.openaiModel };
    }
    return { name: 'unavailable' };
  }

  // txt2img: fallback Pollinations
  return { name: 'pollinations', generate: pollinations, apiKey: '', baseUrl: '', model: config.pollinationsModel };
}

// Validasi konfigurasi sebelum request — kembalikan pesan error yang informatif.
function validateConfig({ providerId, apiKey, baseUrl, model }) {
  const p = getProvider(providerId);
  if (!p) return `Provider "${providerId}" tidak dikenal.`;
  if (!apiKey && p.requiresApiKey) {
    return `API Key ${p.name} belum diisi.`;
  }
  const base = baseUrl || p.defaultBaseUrl;
  if (!base) return `Endpoint provider tidak dikonfigurasi untuk ${p.name}.`;
  if (!/^https?:\/\//i.test(String(base))) return `Base URL ${p.name} tidak valid (harus dimulai http:// atau https://).`;
  return null;
}

module.exports = {
  registry,
  getProvider,
  listProviders,
  resolveProvider,
  validateConfig,
  ratioSize,
  normalizeBase,
  pollinations,
  openaiCompat,
  geminiGenerate,
  testOpenAI,
  testGemini,
  testPollinations,
};
