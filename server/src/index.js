const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const crypto = require('crypto');

const config = require('./config');
const db = require('./db');
const auth = require('./auth');
const jobs = require('./jobs');
const features = require('./features');
const themes = require('./themes');
const providers = require('./providers');
const cryptoKeys = require('./crypto');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// ================= Auth =================

app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Nama, email, dan password wajib diisi' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'Password minimal 6 karakter' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(String(email).toLowerCase());
  if (existing) return res.status(409).json({ error: 'Email sudah terdaftar' });

  const hash = auth.hashPassword(String(password));
  const resInsert = db
    .prepare('INSERT INTO users (name, email, password_hash, credits) VALUES (?, ?, ?, 0)')
    .run(String(name).trim(), String(email).toLowerCase(), hash);
  const userId = resInsert.lastInsertRowid;

  if (config.freeCredits > 0) {
    jobs.addCredit(userId, config.freeCredits, 'signup_bonus', 'Bonus pendaftaran', null);
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  res.json({ token: auth.sign(user), user: auth.publicUser(user) });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email dan password wajib diisi' });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).toLowerCase());
  if (!user || !auth.verifyPassword(String(password), user.password_hash)) {
    return res.status(401).json({ error: 'Email atau password salah' });
  }
  res.json({ token: auth.sign(user), user: auth.publicUser(user) });
});

app.get('/api/me', auth.requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(401).json({ error: 'Akun tidak ditemukan' });
  res.json({ user: auth.publicUser(user) });
});

// Daftar provider yang didukung (untuk UI Pengaturan). Tanpa secret apa pun.
app.get('/api/providers', (_req, res) => {
  res.json({ providers: providers.listProviders() });
});

// Konversi baris ai_models -> bentuk client (camelCase, tanpa data sensitif).
function modelRowToClient(row) {
  return {
    name: row.model_name,
    displayName: row.display_name || row.model_name,
    supportsText: !!row.supports_text,
    supportsImageInput: !!row.supports_image_input,
    supportsImageOutput: !!row.supports_image_output,
    supportsImageEditing: !!row.supports_image_editing,
    supportsMultimodal: !!row.supports_multimodal,
    available: !!row.is_available,
  };
}

// Simpan hasil discovery ke ai_models. Model baru di-upsert; model yang hilang
// dari hasil terbaru ditandai is_available=0 (TIDAK dihapus — point 10).
// Key unik (user_id, provider, model_name) mencegah duplikat saat "Muat Model" diulang.
function syncUserModels(userId, provider, models) {
  const names = models.map((m) => m.name);
  const placeholders = names.length ? names.map(() => '?').join(',') : "''";
  const missing = db.prepare(
    `UPDATE ai_models SET is_available = 0, updated_at = datetime('now')
     WHERE user_id = ? AND provider = ? AND model_name NOT IN (${placeholders})`
  );
  const upsert = db.prepare(
    `INSERT INTO ai_models
       (user_id, provider, model_name, display_name, supports_text, supports_image_input,
        supports_image_output, supports_image_editing, supports_multimodal, is_available)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
     ON CONFLICT(user_id, provider, model_name) DO UPDATE SET
       display_name = excluded.display_name,
       supports_text = excluded.supports_text,
       supports_image_input = excluded.supports_image_input,
       supports_image_output = excluded.supports_image_output,
       supports_image_editing = excluded.supports_image_editing,
       supports_multimodal = excluded.supports_multimodal,
       is_available = 1,
       updated_at = datetime('now')`
  );
  db.exec('BEGIN');
  try {
    missing.run(userId, provider, ...names);
    for (const m of models) {
      upsert.run(
        userId,
        provider,
        m.name,
        m.displayName || m.name,
        m.supportsText ? 1 : 0,
        m.supportsImageInput ? 1 : 0,
        m.supportsImageOutput ? 1 : 0,
        m.supportsImageEditing ? 1 : 0,
        m.supportsMultimodal ? 1 : 0
      );
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

// Daftar model per provider — diambil dinamis dari API provider (model discovery)
// memakai API key user yang tersimpan (didekripsi di server, tidak pernah dikirim keluar).
// Response berisi objek model { name, displayName, supportsText, supportsImageInput,
// supportsImageOutput, supportsImageEditing, supportsMultimodal, available } + summary.
app.post('/api/providers/:id/models', auth.optionalAuth, async (req, res) => {
  const providerId = String(req.params.id || '').trim();
  const p = providers.getProvider(providerId);
  if (!p) {
    return res.json({ ok: false, models: [], message: `Provider "${providerId}" tidak dikenal.` });
  }

  // Key sumber: body (sedang diketik di form) > key user tersimpan > key server.
  const body = req.body || {};
  let apiKey = String(body.apiKey || '').trim();
  if (!apiKey && req.user) {
    const row = db.prepare('SELECT provider_key FROM users WHERE id = ?').get(req.user.id);
    apiKey = cryptoKeys.decryptKey(row?.provider_key) || '';
  }
  if (!apiKey && p.requiresApiKey && providerId === 'openai') {
    apiKey = config.openaiApiKey;
  }

  if (p.requiresApiKey && !apiKey) {
    return res.json({ ok: false, models: [], message: `API Key ${p.name} belum diisi.` });
  }

  const baseUrl = String(body.baseUrl || '').trim() || p.defaultBaseUrl;
  const result = await providers.listProviderModels(providerId, { apiKey, baseUrl });
  // Persist hasil discovery per user agar tersedia setelah refresh halaman,
  // dan model lama yang sudah tidak tersedia ditandai (bukan dihapus).
  if (result.ok && req.user) {
    try {
      syncUserModels(req.user.id, providerId, result.models || []);
    } catch (e) {
      console.error('syncUserModels gagal:', e.message);
    }
  }
  res.json(result);
});

// Model hasil discovery yang tersimpan untuk user ini (untuk isi dropdown langsung
// saat halaman dibuka, tanpa harus tekan "Muat Model" lagi).
app.get('/api/me/models', auth.requireAuth, (_req, res) => {
  const rows = db.prepare('SELECT * FROM ai_models WHERE user_id = ? ORDER BY model_name').all(_req.user.id);
  res.json({ models: rows.map(modelRowToClient) });
});

app.patch('/api/me/provider', auth.requireAuth, (req, res) => {
  const { provider, apiKey, baseUrl, model, modelText, modelImage, modelEditing, enabled, useFreeTxt } = req.body || {};
  const ascii = (s) => /^[\x20-\x7E]*$/.test(s || '');
  if (apiKey && !ascii(apiKey)) {
    return res.status(400).json({
      error: 'API key mengandung karakter tidak valid (mis. tanda pisah "—"). Hapus dan ketik ulang secara manual.',
    });
  }
  if (baseUrl && !ascii(baseUrl)) {
    return res.status(400).json({ error: 'Base URL mengandung karakter tidak valid. Ketik ulang secara manual.' });
  }
  const providerId = String(provider || '').trim();
  if (providerId && !providers.getProvider(providerId)) {
    return res.status(400).json({ error: `Provider "${providerId}" tidak dikenal.` });
  }
  // Key disimpan terenkripsi (AES-256-GCM). Base URL/model normal.
  const encKey = cryptoKeys.encryptKey(String(apiKey || '').trim());
  const flag = req.body.enabled === undefined ? undefined : req.body.enabled ? 1 : 0;
  const useFreeTxtFlag = useFreeTxt ? 1 : 0;

  const current = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const finalKey = apiKey !== undefined ? encKey : current.provider_key;
  const finalBase = baseUrl !== undefined ? String(baseUrl).trim() : current.provider_base_url;
  const finalEnabled = flag !== undefined ? flag : current.provider_enabled;
  const finalProvider = providerId || current.provider || '';

  // Model per kategori: text / image generation / image editing.
  const finalModelText = modelText !== undefined ? String(modelText).trim() : current.provider_model_text;
  let finalModelImage = modelImage !== undefined ? String(modelImage).trim() : current.provider_model_image;
  let finalModelEditing = modelEditing !== undefined ? String(modelEditing).trim() : current.provider_model_editing;
  let finalModel = model !== undefined ? String(model).trim() : current.provider_model;
  // Backward compat: field `model` lama mengisi default image generation
  // bila modelImage tidak dikirim dari form.
  if (model !== undefined && modelImage === undefined) {
    finalModelImage = finalModel;
  }
  // Sinkronkan provider_model (single) ke default image generation supaya
  // logika lama yang membaca provider_model tetap konsisten.
  if (modelImage !== undefined) {
    finalModel = finalModelImage;
  }

  db.prepare(
    'UPDATE users SET provider = ?, provider_key = ?, provider_base_url = ?, provider_model = ?, provider_model_text = ?, provider_model_image = ?, provider_model_editing = ?, provider_enabled = ?, use_free_txt = ? WHERE id = ?'
  ).run(finalProvider, finalKey, finalBase, finalModel, finalModelText, finalModelImage, finalModelEditing, finalEnabled, useFreeTxtFlag, req.user.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: auth.publicUser(user) });
});

// Tes koneksi ke provider yang dipilih (menggunakan endpoint & auth milik provider itu).
app.post('/api/me/provider/test', auth.requireAuth, async (req, res) => {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const body = req.body || {};
  const providerId = String(body.provider || row?.provider || '').trim() || 'openai';
  const p = providers.getProvider(providerId);
  if (!p) {
    return res.json({ ok: false, message: `Provider "${providerId}" tidak dikenal.` });
  }

  const ascii = (s) => /^[\x20-\x7E]*$/.test(s || '');
  const apiKey = String(body.apiKey || cryptoKeys.decryptKey(row?.provider_key) || '').trim();
  if (apiKey && !ascii(apiKey)) {
    return res.json({ ok: false, message: 'API key mengandung karakter non-ASCII (mis. tanda pisah "—"). Hapus dan ketik ulang secara manual.' });
  }

  const baseUrl = String(body.baseUrl || row?.provider_base_url || '').trim() || p.defaultBaseUrl;
  const model = String(body.model || row?.provider_model || '').trim() || p.defaultModel;

  if (p.requiresApiKey && !apiKey) {
    return res.json({ ok: false, url: baseUrl, message: `API Key ${p.name} belum diisi.` });
  }

  // Gunakan adapter test milik provider -> endpoint & auth yang benar.
  const result = await p.test({ apiKey, baseUrl, model });
  return res.json(result);
});

// ================= Kredit / wallet =================

app.get('/api/wallet/transactions', auth.requireAuth, (req, res) => {
  const rows = db
    .prepare('SELECT * FROM credit_transactions WHERE user_id = ? ORDER BY id DESC LIMIT 50')
    .all(req.user.id);
  res.json({ transactions: rows });
});

// Admin: beri / kurangi kredit user
app.post('/api/admin/credits', (req, res) => {
  const key = req.headers['x-admin-key'];
  if (!config.adminApiKey || key !== config.adminApiKey) {
    return res.status(403).json({ error: 'Admin key tidak valid' });
  }
  const { email, amount, note } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email || '').toLowerCase());
  if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });
  const amt = parseInt(amount, 10);
  if (!Number.isFinite(amt) || amt === 0) return res.status(400).json({ error: 'Amount harus angka bukan nol' });
  jobs.addCredit(user.id, amt, 'grant', String(note || 'Grant admin').slice(0, 200), null);
  res.json({ user: auth.publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)) });
});

// ================= Upload gambar =================

const uploadDir = path.join(config.storageDir, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => {
    const ext = (path.extname(file.originalname) || '.png').toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.maxUploadMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Hanya file gambar yang diizinkan'));
  },
});

app.post('/api/uploads', auth.requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File gambar wajib diunggah' });
  const result = db
    .prepare('INSERT INTO uploads (user_id, original_name, mime, size, path) VALUES (?, ?, ?, ?, ?)')
    .run(req.user.id, req.file.originalname, req.file.mimetype, req.file.size, req.file.path);
  res.json({ id: result.lastInsertRowid, name: req.file.originalname });
});

// Sajikan file upload untuk pratinjau (hanya milik user yang bersangkutan)
app.get('/api/uploads/:id/file', auth.requireAuth, (req, res) => {
  const row = db
    .prepare('SELECT * FROM uploads WHERE id = ? AND user_id = ?')
    .get(parseInt(req.params.id, 10), req.user.id);
  if (!row || !fs.existsSync(row.path)) {
    return res.status(404).json({ error: 'File tidak ditemukan' });
  }
  res.type(row.mime || 'image/png');
  res.sendFile(row.path);
});

// ================= Katalog fitur =================

app.get('/api/features', auth.optionalAuth, (_req, res) => {
  res.json({
    categories: features.getCategories(),
    features: features.getFeatures().map((f) => ({
      id: f.id,
      name: f.name,
      category: f.category,
      icon: f.icon,
      type: f.type,
      creditCost: f.creditCost,
      description: f.description,
      uiSchema: f.uiSchema,
    })),
  });
});

// ================= Tema =================

app.get('/api/themes', auth.optionalAuth, (req, res) => {
  res.json(themes.listFor(req.user ? req.user.id : null));
});

app.post('/api/themes/:id/purchase', auth.requireAuth, (req, res) => {
  try {
    res.json(themes.purchase(req.user.id, req.params.id));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, code: err.code });
  }
});

// ================= Generate & jobs =================

app.post('/api/generate', auth.requireAuth, (req, res) => {
  const { featureId, formValues, ratio, count } = req.body || {};
  const images = Array.isArray(req.body.images) ? req.body.images : [];
  try {
    const result = jobs.createBatch({
      userId: req.user.id,
      featureId,
      formValues: formValues || {},
      images,
      ratio,
      count,
    });
    res.json({ batchId: result.batchId, jobs: result.jobIds });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, code: err.code });
  }
});

app.get('/api/jobs/:batchId', auth.requireAuth, (req, res) => {
  const batch = jobs.getBatch(req.params.batchId, req.user.id);
  if (!batch) return res.status(404).json({ error: 'Batch tidak ditemukan' });
  res.json(batch);
});

app.get('/api/results/:jobId/file', auth.requireAuth, (req, res) => {
  const file = jobs.getJobFile(parseInt(req.params.jobId, 10), req.user.id);
  if (!file) return res.status(404).json({ error: 'Hasil tidak ditemukan' });
  res.type(file.mime);
  res.sendFile(file.path);
});

app.get('/api/history', auth.requireAuth, (req, res) => {
  res.json({ items: jobs.history(req.user.id) });
});

// ================= Health =================

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'auraphoto-server',
    provider: config.defaultProvider,
    hasServerKey: !!config.openaiApiKey,
    freeCredits: config.freeCredits,
  });
});

// Serve hasil build frontend jika ada (production)
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^\/(?!api).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

// Error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Terjadi kesalahan' });
});

jobs.markStaleAsError();

app.listen(config.port, () => {
  console.log(`AuraPhoto server berjalan di http://localhost:${config.port}`);
});
