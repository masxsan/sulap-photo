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

// Log aman untuk request AI. TIDAK PERNAH mencatat API key / token.
// Mencatat: provider, model, endpoint, metode, status, durasi, dan pesan error.
function providerLog({ provider, model, baseUrl, endpoint, method, status, ms, error }) {
  const parts = [
    `[ai]`,
    `provider=${provider || '-'}`,
    `model=${model || '-'}`,
    `endpoint=${endpoint || '-'}`,
    method ? `method=${method}` : null,
    status ? `status=${status}` : null,
    ms ? `${ms}ms` : null,
    error ? `error=${String(error).replace(/\n/g, ' ').slice(0, 300)}` : null,
  ].filter(Boolean);
  console.log(parts.join(' '));
}

// Ambil daftar model dari API provider. Tiap provider punya caranya sendiri.
// Tidak pernah menampilkan/menyimpan API key ke log.

async function geminiListModels({ apiKey, baseUrl }) {
  const base = normalizeBase(baseUrl, config.geminiBaseUrl);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(`${base}/models`, { headers: { 'x-goog-api-key': apiKey }, signal: ctrl.signal });
    const text = await r.text().catch(() => '');
    if (!r.ok) return { ok: false, models: [], message: `Google Gemini (${r.status}): ${text.slice(0, 160)}` };
    let data = null;
    try { data = JSON.parse(text); } catch { /* bukan JSON */ }
    // Filter model image-generation: nama mengandung 'image'/'imagen' dan mendukung generateContent
    const models = (data?.models || [])
      .filter((m) => {
        const name = String(m.name || '');
        const methods = m.supportedGenerationMethods || [];
        const imageish = /image|imagen/i.test(name);
        const canGen = methods.includes('generateContent') || methods.includes('GenerateContent');
        return imageish && canGen;
      })
      .map((m) => String(m.name).replace(/^models\//, ''))
      .sort();
    return { ok: true, models };
  } catch (err) {
    return { ok: false, models: [], message: `Gagal ambil daftar model Gemini: ${err?.message || 'kesalahan tak dikenal'}` };
  } finally {
    clearTimeout(timer);
  }
}

async function openaiListModels({ apiKey, baseUrl }) {
  const base = normalizeBase(baseUrl, config.openaiBaseUrl);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(`${base}/models`, { headers: { Authorization: `Bearer ${apiKey}` }, signal: ctrl.signal });
    const text = await r.text().catch(() => '');
    if (!r.ok) return { ok: false, models: [], message: `OpenAI (${r.status}): ${text.slice(0, 160)}` };
    let data = null;
    try { data = JSON.parse(text); } catch { /* bukan JSON */ }
    const ids = (data?.data || []).map((m) => m.id).filter(Boolean);
    // Prioritaskan model pembuat gambar; bila tak ada, tampilkan semua (untuk API OpenAI-compatible).
    const imageish = ids.filter((id) => /gpt-image|dall-e|image/i.test(id));
    return { ok: true, models: imageish.length ? imageish : ids.slice(0, 50) };
  } catch (err) {
    return { ok: false, models: [], message: `Gagal ambil daftar model OpenAI: ${err?.message || 'kesalahan tak dikenal'}` };
  } finally {
    clearTimeout(timer);
  }
}

// Wrapper: panggil method listModels milik provider, fallback ke daftar statis.
async function listProviderModels(providerId, opts) {
  const p = getProvider(providerId);
  if (!p) return { ok: false, models: [], message: `Provider "${providerId}" tidak dikenal.` };
  if (typeof p.listModels === 'function') return p.listModels(opts);
  return { ok: true, models: p.models || [] };
}

// ---------- Adapter: Pollinations (gratis, txt2img) ----------

async function pollinations({ prompt, ratio, model }) {
  const [w, h] = ratioSize(ratio);
  const m = model || config.pollinationsModel;
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(
    prompt
  )}?width=${w}&height=${h}&nologo=true&model=${m}`;
  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 120000);
  try {
    const res = await pFetch(url, {
      signal: ctrl.signal,
      headers: { accept: 'image/*' },
    });
    providerLog({ provider: 'pollinations', model: m, baseUrl: url, endpoint: url, method: 'GET', status: res.status, ms: Date.now() - started });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      providerLog({ provider: 'pollinations', model: m, endpoint: url, method: 'GET', status: res.status, error: text.slice(0, 200) });
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
  const path = feature.type === 'img2img' ? '/images/edits' : '/images/generations';
  const endpoint = `${base}${path}`;
  const started = Date.now();
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
        (withFormat) => pFetch(endpoint, { method: 'POST', headers, body: form(withFormat), signal: ctrl.signal }),
        ctrl
      );
      providerLog({ provider: 'openai', model: m, baseUrl: base, endpoint, method: 'POST', status: res.status, ms: Date.now() - started });
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
          pFetch(endpoint, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: body(withFormat),
            signal: ctrl.signal,
          }),
        ctrl
      );
      providerLog({ provider: 'openai', model: m, baseUrl: base, endpoint, method: 'POST', status: res.status, ms: Date.now() - started });
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
  } catch (err) {
    providerLog({ provider: 'openai', model: m, baseUrl: base, endpoint, method: 'POST', ms: Date.now() - started, error: err.message });
    throw err;
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
// Fallback model image-generation Gemini bila discovery API gagal/offline.
// Model lama (gemini-2.0-flash-*-image-generation, gemini-2.5-flash-image-preview)
// sudah pensiun (404) dan TIDAK lagi didaftarkan di sini.
// Model aktif (2026): gemini-2.5-flash-image (Nano Banana, stable),
// gemini-3.1-flash-image-preview (Nano Banana 2), gemini-3-pro-image-preview.
// Sumber utama daftar model adalah model discovery dari API Gemini.
const GEMINI_MODELS = [
  'gemini-2.5-flash-image',
  'gemini-3.1-flash-image-preview',
  'gemini-3-pro-image-preview',
];

async function geminiGenerate({ feature, prompt, images, ratio, model, apiKey, baseUrl }) {
  const base = normalizeBase(baseUrl, config.geminiBaseUrl);
  // Model selalu diambil dari pilihan user (tersimpan di DB / SettingsView).
  // Tidak fallback ke daftar statis supaya model yang sudah pensiun tidak muncul.
  const m = (model || config.geminiModel || '').trim();
  if (!m) {
    throw new Error('Model Gemini belum dipilih. Buka Pengaturan → AI Providers → Google Gemini → Muat Model, lalu pilih model yang tersedia.');
  }
  const endpoint = `${base}/models/${encodeURIComponent(m)}:generateContent`;
  const started = Date.now();

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
    const res = await pFetch(endpoint, {
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
      providerLog({
        provider: 'gemini',
        model: m,
        baseUrl: base,
        endpoint,
        method: 'POST',
        status: res.status,
        ms: Date.now() - started,
        error: apiMsg,
      });
      if (res.status === 401 || res.status === 403) {
        throw new Error(`Google Gemini API Key tidak valid (${res.status}). Pastikan key benar & masih aktif.`);
      }
      if (res.status === 404) {
        // Model tidak ada / pensiun — bantu user memilih model yang tersedia.
        let hint = '';
        try {
          const d = await geminiListModels({ apiKey, baseUrl });
          if (d.ok && d.models.length) {
            hint = ` Model yang tersedia: ${d.models.slice(0, 8).join(', ')}.`;
          }
        } catch {
          /* log discovery gagal, lanjut dengan pesan umum */
        }
        throw new Error(`Model tidak tersedia untuk Google Gemini: ${m}.${hint} Pilih model dari daftar di Pengaturan → AI Providers.`);
      }
      throw new Error(`Google Gemini error (${res.status}): ${apiMsg}`);
    }

    providerLog({
      provider: 'gemini',
      model: m,
      baseUrl: base,
      endpoint,
      method: 'POST',
      status: res.status,
      ms: Date.now() - started,
    });

    const candidate = data?.candidates?.[0];
    const partsOut = candidate?.content?.parts || [];
    const imgPart = partsOut.find((p) => p.inlineData?.data || p.inline_data?.data);
    const raw = imgPart?.inlineData?.data || imgPart?.inline_data?.data;
    if (raw) {
      return Buffer.from(raw, 'base64');
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
    listModels: async () => ({ ok: true, models: ['flux', 'turbo'] }),
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
    listModels: openaiListModels,
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Google AI Studio (generativelanguage.googleapis.com). Autentikasi via x-goog-api-key.',
    requiresApiKey: true,
    supportsImg2img: true,
    defaultBaseUrl: config.geminiBaseUrl,
    // Default KOSONG: model diisi dari hasil "Muat Model" (discovery API), bukan hardcoded.
    defaultModel: config.geminiModel || '',
    models: GEMINI_MODELS,
    generate: geminiGenerate,
    test: testGemini,
    listModels: geminiListModels,
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
        // Model user apa adanya (dari DB). Bila kosong, biarkan kosong —
        // geminiGenerate akan memberi pesan jelas, jangan fallback statis.
        model: user.provider_model || '',
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
  listProviderModels,
  resolveProvider,
  validateConfig,
  ratioSize,
  normalizeBase,
  pollinations,
  openaiCompat,
  geminiGenerate,
  geminiListModels,
  openaiListModels,
  providerLog,
  testOpenAI,
  testGemini,
  testPollinations,
};
