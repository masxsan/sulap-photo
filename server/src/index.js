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

app.patch('/api/me/provider', auth.requireAuth, (req, res) => {
  const { apiKey, baseUrl, model } = req.body || {};
  db.prepare('UPDATE users SET provider_key = ?, provider_base_url = ?, provider_model = ? WHERE id = ?').run(
    String(apiKey || '').trim(),
    String(baseUrl || '').trim(),
    String(model || '').trim(),
    req.user.id
  );
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: auth.publicUser(user) });
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
    service: 'sulap-photo-server',
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
  console.log(`Sulap Photo server berjalan di http://localhost:${config.port}`);
});
