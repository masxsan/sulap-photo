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
    // OpenAI /models tidak menyediakan metadata capability. Prioritaskan model
    // pembuat gambar (nama mengandung gpt-image/dall-e/image). Bila tak ada,
    // tampilkan model LLM generik (capability text saja — tidak diklaim image).
    const imageish = ids.filter((id) => /gpt-image|dall-e|image/i.test(id));
    const selected = imageish.length ? imageish : ids.slice(0, 50);
    const models = selected.map((id) =>
      imageish.length
        ? modelEntry(id, id, { supportsImageOutput: true, supportsImageInput: true, supportsImageEditing: true })
        : modelEntry(id, id, { supportsText: true })
    );
    return { ok: true, models, summary: summarizeModels(models) };
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
  const models = Array.isArray(p.models) ? p.models : [];
  return { ok: true, models, summary: summarizeModels(models) };
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

// ---------- Capability detection ----------

// Bentuk normal model yang dipakai di seluruh sistem.
// { name, displayName, supportsText, supportsImageInput, supportsImageOutput,
//   supportsImageEditing, supportsMultimodal, available, inputTokenLimit,
//   outputTokenLimit, supportedMethods, priority, status }
function modelEntry(name, displayName, caps = {}) {
  return {
    name,
    displayName: displayName || name,
    supportsText: !!caps.supportsText,
    supportsImageInput: !!caps.supportsImageInput,
    supportsImageOutput: !!caps.supportsImageOutput,
    supportsImageEditing: !!caps.supportsImageEditing,
    supportsMultimodal: !!caps.supportsMultimodal,
    available: caps.available !== false,
    inputTokenLimit: caps.inputTokenLimit || 0,
    outputTokenLimit: caps.outputTokenLimit || 0,
    supportedMethods: caps.supportedMethods || [],
    priority: caps.priority || 0,
    status: caps.status || 'unknown',
  };
}

// Deteksi capability model Gemini dari metadata API (bukan hanya nama).
// Bukti PRIMER = supportedGenerationMethods memuat generateContent (model bisa
// dipanggil lewat endpoint yang sama). Capability lain dibaca dari deskripsi /
// display name yang ditulis provider. Tanpa bukti, capability dianggap false
// (tidak menyatakan image generation tanpa bukti — point 5).
function detectGeminiCapabilities(raw) {
  const name = String(raw.name || '').replace(/^models\//, '').trim();
  if (!name) return null;
  const methods = raw.supportedGenerationMethods || [];
  const canGenerate = methods.some((m) => /generateContent/i.test(String(m)));
  // Tanpa bukti generateContent, model tidak dapat dipakai lewat endpoint ini
  // (mis. model embedding/retrieval) — keluarkan dari daftar.
  if (!canGenerate) return null;
  const displayName = String(raw.displayName || '').trim();
  const desc = String(raw.description || '');
  const lname = name.toLowerCase();
  const blob = `${displayName} ${desc}`.toLowerCase();

  // Bukti tambahan dari metadata tertulis provider:
  const saysImageGeneration = /image generation|image editing|image-to-image|text-to-image|nano banana|image model|generate images|image-to-3d|editing/i.test(blob);
  const saysVision = /vision|multimodal|image understanding|image input|image(s)?\b/i.test(blob);
  const isImagen = /^imagen/i.test(name);
  const imageGenName = /flash-image|image-generation|image-gen|image-preview|imagen/i.test(lname);

  // Bukti PRIMER: model harus bisa dipanggil lewat generateContent.
  const supported = canGenerate;

  const supportsImageOutput = supported && (imageGenName || saysImageGeneration);
  // Image input: model bukan imagen (imagen = text->image saja) dan ada bukti
  // multimodal/vision/penanganan gambar.
  const supportsImageInput = supported && !isImagen && (saysVision || imageGenName);
  const supportsText = supported && !isImagen;
  const supportsImageEditing = supportsImageOutput && supportsImageInput;
  const supportsMultimodal = supportsImageInput && supportsText;

  return modelEntry(name, displayName || name, {
    supportsText,
    supportsImageInput,
    supportsImageOutput,
    supportsImageEditing,
    supportsMultimodal,
    // Metadata dari API (jika tersedia) — disimpan, bukan diarang berdasarkan nama.
    inputTokenLimit: raw.inputTokenLimit || 0,
    outputTokenLimit: raw.outputTokenLimit || 0,
    supportedMethods: methods,
    priority: supportsImageOutput ? 1 : 2,
    status: 'ready',
  });
}

// Ringkasan jumlah model per capability untuk pesan ke user.
function summarizeModels(models) {
  const text = models.filter((m) => m.supportsText);
  const vision = models.filter((m) => m.supportsImageInput);
  const imageGeneration = models.filter((m) => m.supportsImageOutput);
  const imageEditing = models.filter((m) => m.supportsImageEditing);
  return {
    total: models.length,
    text: text.length,
    vision: vision.length,
    imageGeneration: imageGeneration.length,
    imageEditing: imageEditing.length,
  };
}

// Klasifikasi + pesan ramah untuk error Gemini (tanpa informasi sensitif).
// Mengenali: 400, 401, 403, 404, 429, 500, 503, dan error jaringan.
// Mengembalikan { status, code, retryable, message }.
// retryable = layak retry/fallback (429, 500, 503, transient network).
// 429 != API key invalid — model tetap dipertahankan (point 6).
function handleGeminiError(status, text, model) {
  let apiMsg = '';
  try {
    const d = JSON.parse(text);
    apiMsg = d?.error?.message || '';
  } catch { /* bukan JSON */ }
  const code = (c) => ({ status, code: c, message: '' });

  if (status === 400 && /API key not valid|API_KEY_INVALID|API key expired|API key has expired/i.test(apiMsg)) {
    return { ...code('AUTH'), retryable: false, message: `Google Gemini API Key tidak valid (${status}). Pastikan key benar & masih aktif.` };
  }
  if (status === 400) {
    return { ...code('BAD_REQUEST'), retryable: false, message: `Google Gemini menolak request (400): ${(apiMsg || text).slice(0, 160)}` };
  }
  if (status === 401 || status === 403) {
    return { ...code('AUTH'), retryable: false, message: `Google Gemini API Key tidak valid (${status}). Pastikan key benar & masih aktif.` };
  }
  if (status === 404) {
    return { ...code('NOT_FOUND'), retryable: false, message: `Model tidak tersedia untuk Google Gemini${model ? ': ' + model : ''} (404). Periksa nama model & Base URL.` };
  }
  if (status === 429) {
    return {
      ...code('RATE_LIMITED'),
      retryable: true,
      message: `Quota/rate limit exceeded (429). Model${model ? ' ' + model : ''} ditemukan tetapi sementara tidak dapat digunakan. Silakan coba lagi beberapa saat.`,
    };
  }
  if (status === 500 || status === 503) {
    return { ...code('SERVER'), retryable: true, message: `Google Gemini sedang sibuk/bermasalah (${status}). Silakan coba lagi beberapa saat.` };
  }
  return { ...code('OTHER'), retryable: false, message: `Google Gemini (${status}): ${(apiMsg || text).slice(0, 160)}` };
}

// Bungkus error Gemini: attach code/retryable/model agar lapisan atas (jobs.js,
// frontend) bisa bereaksi — tanpa menyimpan API key di pesan.
function geminiError(status, text, model) {
  const h = handleGeminiError(status, text, model);
  const e = new Error(h.message);
  e.code = h.code;
  e.retryable = h.retryable;
  e.status = h.status;
  e.model = model || null;
  e.gemini = true;
  return e;
}

// ---------- Adapter: Google Gemini (generativelanguage.googleapis.com) ----------

const GEMINI_DEFAULT_BASE = 'https://generativelanguage.googleapis.com/v1beta';
// Fallback model Gemini bila discovery API gagal/offline. Sumber utama daftar
// model adalah model discovery dari API Gemini — daftar ini hanya cadangan.
// Model lama (gemini-2.0-flash-*-image-generation, gemini-2.5-flash-image-preview)
// sudah pensiun (404) dan TIDAK lagi didaftarkan di sini.
const GEMINI_MODELS = [
  {
    name: 'models/gemini-2.5-flash-image',
    displayName: 'Gemini 2.5 Flash Image',
    description: 'Nano Banana — image generation & editing (text/image in, image out)',
    supportedGenerationMethods: ['generateContent'],
  },
  {
    name: 'models/gemini-3.1-flash-image-preview',
    displayName: 'Gemini 3.1 Flash Image (Preview)',
    description: 'Nano Banana 2 — image generation & editing (text/image in, image out)',
    supportedGenerationMethods: ['generateContent'],
  },
  {
    name: 'models/gemini-3-pro-image-preview',
    displayName: 'Gemini 3 Pro Image (Preview)',
    description: 'Image generation & editing (text/image in, image out)',
    supportedGenerationMethods: ['generateContent'],
  },
  {
    name: 'models/gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
    description: 'Multimodal text & image input, text output',
    supportedGenerationMethods: ['generateContent'],
  },
].map(detectGeminiCapabilities).filter(Boolean);

// Tidur singkat untuk backoff (bukan promisify agar ringkas).
function sleepMs(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function geminiListModels({ apiKey, baseUrl }) {
  const base = normalizeBase(baseUrl, config.geminiBaseUrl);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  const attempt = async (delayMs) => {
    if (delayMs) await sleepMs(delayMs);
    if (ctrl.signal.aborted) throw new Error('timeout');
    const r = await fetch(`${base}/models`, { headers: { 'x-goog-api-key': apiKey }, signal: ctrl.signal });
    const text = await r.text().catch(() => '');
    if (!r.ok) throw Object.assign(geminiError(r.status, text), { text, statusCode: r.status });
    let data = null;
    try { data = JSON.parse(text); } catch { /* bukan JSON */ }
    // Ambil SEMUA model yang bisa dipanggil lewat generateContent (bukti dari API),
    // lalu deteksi capability tiap model. Tidak mem-filter berdasarkan nama saja.
    const models = (data?.models || [])
      .map(detectGeminiCapabilities)
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));
    return { ok: true, models, summary: summarizeModels(models), source: 'api' };
  };
  try {
    try {
      return await attempt(0);
    } catch (err) {
      // Retry kecil untuk 429 / 5xx / transient — discovery tidak boleh cepat gagal.
      if (err?.statusCode === 429 || err?.statusCode === 500 || err?.statusCode === 503 || err?.status === 502) {
        const delays = [1200, 2500];
        for (const d of delays) {
          try {
            return await attempt(d);
          } catch (e2) {
            if (e2?.statusCode !== 429 && e2?.statusCode !== 500 && e2?.statusCode !== 503 && e2?.status !== 502) throw e2;
          }
        }
      }
      throw err;
    }
  } catch (err) {
    // Discovery gagal (429, 5xx, network). Jangan gagalkan "Muat Model":
    // kembalikan daftar cadangan statis sebagai fallback + catatan rate-limit,
    // supaya user tetap punya model untuk dipilih (point 3/4/6).
    if (err?.code === 'RATE_LIMITED') {
      return { ok: true, models: GEMINI_MODELS, summary: summarizeModels(GEMINI_MODELS), source: 'fallback', rateLimited: true, message: handleGeminiError(429, '', '').message };
    }
    if (err?.statusCode >= 500 || err?.status === 502) {
      return { ok: true, models: GEMINI_MODELS, summary: summarizeModels(GEMINI_MODELS), source: 'fallback', message: `Google Gemini tidak merespons (${err.statusCode || err.status || '5xx'}). Menampilkan daftar model cadangan.` };
    }
    // Kegagalan jaringan (fetch TypeError) saat discovery — fallback juga.
    if (err?.code === 'NETWORK' || err?.cause?.code || err?.message?.startsWith('fetch failed')) {
      return { ok: true, models: GEMINI_MODELS, summary: summarizeModels(GEMINI_MODELS), source: 'fallback', message: `Gagal terhubung ke Google Gemini saat memuat model. Menampilkan daftar model cadangan.` };
    }
    if (err?.code === 'AUTH' || err?.code === 'NOT_FOUND') {
      return { ok: false, models: [], message: handleGeminiError(err.statusCode || err.status, err.text || '').message };
    }
    return { ok: false, models: [], message: `Gagal ambil daftar model Gemini: ${err?.message || 'kesalahan tak dikenal'}` };
  } finally {
    clearTimeout(timer);
  }
}

// Probe ringan: pastikan model benar-benar menghasilkan gambar (bukti keras).
async function geminiProbeImage({ apiKey, baseUrl, model }) {
  const base = normalizeBase(baseUrl, config.geminiBaseUrl);
  const endpoint = `${base}/models/${encodeURIComponent(model)}:generateContent`;
  const body = {
    contents: [{ parts: [{ text: 'Create a tiny solid color test image.' }] }],
    generationConfig: { responseModalities: ['IMAGE'] },
  };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await pFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text().catch(() => '');
    let data = null;
    try { data = JSON.parse(text); } catch { /* bukan JSON */ }
    if (!res.ok) {
      providerLog({ provider: 'gemini', model, baseUrl: base, endpoint, method: 'POST', status: res.status, ms: 0, error: handleGeminiError(res.status, text).message });
      throw geminiError(res.status, text, model);
    }
    const partsOut = data?.candidates?.[0]?.content?.parts || [];
    const hasImage = partsOut.some((p) => p.inlineData?.data || p.inline_data?.data);
    if (!hasImage) throw new Error('Model tidak mengembalikan gambar pada probe uji.');
    return true;
  } finally {
    clearTimeout(timer);
  }
}

// Satu percobaan generate ke satu model. Mengembalikan Buffer gambar.
// Error diklasifikasikan via geminiError() — retry/fallback di lapisan atas.
async function geminiGenerateOnce({ endpoint, model, apiKey, body, started, ctrl }) {
  let res;
  try {
    res = await pFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (err) {
    // pFetch: kegagalan jaringan (DNS, timeout, TLS) — retryable.
    const e = new Error(err.message);
    e.code = 'NETWORK';
    e.retryable = true;
    e.status = 502;
    e.model = model;
    e.gemini = true;
    throw e;
  }
  const text = await res.text().catch(() => '');
  let data = null;
  try { data = JSON.parse(text); } catch { /* bukan JSON */ }
  if (!res.ok) {
    const e = geminiError(res.status, text, model);
    providerLog({ provider: 'gemini', model, baseUrl: endpoint.split('/models/')[0], endpoint, method: 'POST', status: res.status, ms: Date.now() - started, error: e.message });
    throw e;
  }
  providerLog({ provider: 'gemini', model, baseUrl: endpoint.split('/models/')[0], endpoint, method: 'POST', status: res.status, ms: Date.now() - started });
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
}

// Generate dengan retry/backoff (429/5xx/network) lalu fallback ke model lain
// (404/429/5xx/network) bila model terpilih gagal. Prioritas model image-gen dulu.
// API key invalid (401/403) TIDAK di-retry dan TIDAK di-fallback (point 6).
async function geminiGenerate({ feature, prompt, images, ratio, model, apiKey, baseUrl }) {
  const base = normalizeBase(baseUrl, config.geminiBaseUrl);
  // Normalisasi: terima "gemini-..." atau "models/gemini-..." — keduanya dipakai
  // bergantung sumber (DB discovery menyimpan tanpa prefix; input lain bisa ber-prefix).
  const m = (model || config.geminiModel || '').trim().replace(/^models\//, '');
  if (!m) {
    throw new Error('Model Gemini belum dipilih. Buka Pengaturan → AI Providers → Google Gemini → Muat Model, lalu pilih model yang tersedia.');
  }

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

  const started = Date.now();
  const ctrl = new AbortController();
  // Batas total seluruh percobaan (retry + fallback), bukan per-attempt.
  const timer = setTimeout(() => ctrl.abort(), 240000);

  const attempt = async (candidate) => {
    const endpoint = `${base}/models/${encodeURIComponent(candidate)}:generateContent`;
    const backoff = [0, 2000, 5000];
    let lastErr = null;
    for (let i = 0; i < backoff.length; i++) {
      if (i > 0) await sleepMs(backoff[i]);
      try {
        return await geminiGenerateOnce({ endpoint, model: candidate, apiKey, body, started, ctrl });
      } catch (err) {
        lastErr = err;
        // Retry backoff hanya untuk 429 / 5xx / network. Error lain langsung lempar
        // (404 = model pensiun, cukup sekali, fallback di lapisan atas).
        if (err.code === 'RATE_LIMITED' || err.code === 'SERVER' || err.code === 'NETWORK' || err.status === 502) {
          continue;
        }
        throw err;
      }
    }
    throw lastErr;
  };

  try {
    try {
      return await attempt(m);
    } catch (err) {
      // API key invalid / bad request / tak dikenal: tidak ada gunanya fallback.
      if (err.code === 'AUTH' || err.code === 'BAD_REQUEST' || err.code === 'OTHER') throw err;
      // 404 / 429 / 5xx / network pada model terpilih: coba model cadangan.
      const d = await geminiListModels({ apiKey, baseUrl }).catch(() => null);
      const fallbacks = (d && d.ok && d.models.length
        ? d.models.filter((x) => x.supportsImageOutput && x.name !== m)
        : [])
        .sort((a, b) => (a.priority || 0) - (b.priority || 0) || a.name.localeCompare(b.name))
        .map((x) => x.name);
      if (!fallbacks.length) throw err;
      let lastErr = err;
      for (const cand of fallbacks) {
        try {
          return await attempt(cand);
        } catch (e2) {
          lastErr = e2;
          if (e2.code === 'AUTH' || e2.code === 'BAD_REQUEST' || e2.code === 'OTHER') break;
        }
      }
      throw lastErr;
    }
  } finally {
    clearTimeout(timer);
  }
}

// Test koneksi bertahap: koneksi -> key valid -> model discovery -> image tersedia
// -> (bila ada model terpilih) probe image generation. Hasil `steps` untuk UI.
// Test TIDAK memanggil probe bila hanya "discovery" — probe hanya dijalankan
// saat test eksplisit dipicu user (point 7). 429 pada probe bukanlah kegagalan
// koneksi/key — dilaporkan sebagai langkah info, bukan error fatal.
async function testGemini({ apiKey, baseUrl, model }) {
  const base = normalizeBase(baseUrl, config.geminiBaseUrl);
  const modelName = (model || '').trim().replace(/^models\//, '');
  const steps = [];
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  try {
    const r = await fetch(`${base}/models`, { headers: { 'x-goog-api-key': apiKey }, signal: ctrl.signal });
    const text = await r.text().catch(() => '');
    if (!r.ok) {
      const h = handleGeminiError(r.status, text);
      steps.push({ label: 'Koneksi ke Google Gemini API', ok: false, detail: h.message });
      return { ok: false, url: base, status: r.status, steps, message: h.message };
    }
    steps.push({ label: 'Koneksi ke Google Gemini API', ok: true, detail: 'API dapat diakses.' });
    steps.push({ label: 'API Key valid', ok: true, detail: 'Key diterima oleh Google Gemini.' });

    let data = null;
    try { data = JSON.parse(text); } catch { /* bukan JSON */ }
    const models = (data?.models || []).map(detectGeminiCapabilities).filter(Boolean);
    steps.push({ label: 'Daftar model dimuat', ok: true, detail: `${models.length} model tersedia.` });

    const imageModels = models.filter((m) => m.supportsImageOutput);
    if (imageModels.length) {
      const preview = imageModels.slice(0, 3).map((m) => m.name).join(', ') + (imageModels.length > 3 ? '…' : '');
      steps.push({ label: 'Image generation tersedia', ok: true, detail: `${imageModels.length} model mendukung image generation (${preview}).` });
    } else {
      steps.push({ label: 'Image generation tersedia', ok: false, detail: 'Tidak ada model image generation yang terdeteksi pada key ini.' });
    }

    // Probe image generation HANYA bila user eksplisit meminta test (bukan saat
    // "Muat Model"/discovery) dan model terpilih mendukung image output.
    if (modelName) {
      const sel = models.find((m) => m.name === modelName);
      if (sel && sel.supportsImageOutput) {
        try {
          await geminiProbeImage({ apiKey, baseUrl, model: modelName });
          steps.push({ label: `Probe model "${modelName}"`, ok: true, detail: 'Model berhasil menghasilkan gambar uji.' });
        } catch (e) {
          if (e?.code === 'RATE_LIMITED') {
            // 429 saat probe: bukan masalah key/koneksi — info, jangan hard-fail.
            steps.push({ label: `Probe model "${modelName}"`, ok: false, detail: `${e.message} Model tetap terdaftar dan akan diuji lagi nanti.` });
          } else {
            steps.push({ label: `Probe model "${modelName}"`, ok: false, detail: e.message });
          }
        }
      } else if (sel) {
        steps.push({ label: `Probe model "${modelName}"`, ok: false, detail: 'Model terpilih tidak mendukung image generation.' });
      }
    }

    const failed = steps.filter((s) => !s.ok);
    const ok = failed.length === 0;
    return {
      ok,
      url: base,
      status: 200,
      steps,
      message: ok
        ? 'Google Gemini API terhubung — semua langkah berhasil.'
        : `Google Gemini API terhubung, tapi ${failed.length} langkah gagal: ${failed[0].detail}`,
    };
  } catch (err) {
    steps.push({ label: 'Koneksi ke Google Gemini API', ok: false, detail: err?.message || 'kesalahan tak dikenal' });
    return { ok: false, url: base, steps, message: `Gagal terhubung ke ${base}: ${err?.message || 'kesalahan tak dikenal'}` };
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
    models: ['flux', 'turbo'].map((id) => modelEntry(id, id, { supportsImageOutput: true, supportsText: true })),
    generate: pollinations,
    test: testPollinations,
    listModels: async () => ({
      ok: true,
      models: ['flux', 'turbo'].map((id) => modelEntry(id, id, { supportsImageOutput: true, supportsText: true })),
      summary: summarizeModels(['flux', 'turbo'].map((id) => modelEntry(id, id, { supportsImageOutput: true, supportsText: true }))),
    }),
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    description: 'OpenAI atau API serupa (OpenAI-compatible). Mendukung txt2img & img2img.',
    requiresApiKey: true,
    supportsImg2img: true,
    defaultBaseUrl: config.openaiBaseUrl,
    defaultModel: config.openaiModel,
    models: ['gpt-image-1', 'dall-e-3'].map((id) =>
      modelEntry(id, id, { supportsImageOutput: true, supportsImageInput: id !== 'dall-e-3', supportsImageEditing: id !== 'dall-e-3' })
    ),
    generate: openaiCompat,
    test: testOpenAI,
    listModels: openaiListModels,
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Google AI Studio (generativelanguage.googleapis.com). Autentikasi via x-goog-api-key. Satu API key untuk banyak model Gemini.',
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

// Pilih model yang sesuai untuk fitur tertentu (model routing berbasis capability).
// Gemini: fitur img2img pakai default image-editing (bisa fallback ke image gen);
// fitur txt2img pakai default image-generation. Fitur teks pakai default text.
// Provider lain tetap memakai satu model yang dipilih user.
function resolveModelForProvider(p, feature, user) {
  if (p.id === 'gemini') {
    if (feature.type === 'img2img') {
      return user.provider_model_editing || user.provider_model_image || user.provider_model || '';
    }
    // txt2img / fitur berbasis teks
    return user.provider_model_image || user.provider_model || user.provider_model_text || '';
  }
  return user.provider_model || p.defaultModel || '';
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
        model: resolveModelForProvider(p, feature, user),
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
  resolveModelForProvider,
  validateConfig,
  ratioSize,
  normalizeBase,
  pollinations,
  openaiCompat,
  geminiGenerate,
  geminiListModels,
  geminiProbeImage,
  openaiListModels,
  detectGeminiCapabilities,
  summarizeModels,
  modelEntry,
  providerLog,
  testOpenAI,
  testGemini,
  testPollinations,
  handleGeminiError,
  geminiError,
};
