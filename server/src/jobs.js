const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');
const config = require('./config');
const features = require('./features');
const providers = require('./providers');

// Antrean in-memory (jika server restart, job yang belum selesai ditandai error).
const queue = [];
let processing = false;

function loadUser(userId) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(userId) || null;
}

function addCredit(userId, amount, type, note, jobId) {
  db.prepare('UPDATE users SET credits = credits + ? WHERE id = ?').run(amount, userId);
  db.prepare(
    'INSERT INTO credit_transactions (user_id, amount, type, note, job_id) VALUES (?, ?, ?, ?, ?)'
  ).run(userId, amount, type, note, jobId || null);
}

function getCreditBalance(userId) {
  const u = db.prepare('SELECT credits FROM users WHERE id = ?').get(userId);
  return u ? u.credits : 0;
}

// Tentukan provider untuk sebuah job berdasarkan fitur + konfigurasi user.
function resolveProvider(feature, user) {
  const userKey = user.provider_key || '';
  const serverKey = config.openaiApiKey;

  if (feature.type === 'img2img') {
    // img2img butuh API key OpenAI-compatible (Pollinations gratis hanya txt2img)
    if (userKey) return { name: 'openai', apiKey: userKey, baseUrl: user.provider_base_url || config.openaiBaseUrl, model: user.provider_model || config.openaiModel };
    if (serverKey) return { name: 'openai', apiKey: serverKey, baseUrl: config.openaiBaseUrl, model: config.openaiModel };
    return { name: 'unavailable' };
  }

  // txt2img
  // Jika user mengaktifkan "pakai gratis untuk fitur teks", selalu pakai Pollinations.
  if (user.use_free_txt) return { name: 'pollinations' };
  if (userKey) return { name: 'openai', apiKey: userKey, baseUrl: user.provider_base_url || config.openaiBaseUrl, model: user.provider_model || config.openaiModel };
  if (serverKey) return { name: 'openai', apiKey: serverKey, baseUrl: config.openaiBaseUrl, model: config.openaiModel };
  return { name: 'pollinations' };
}

// Jalankan satu job.
async function runJob(job) {
  const user = loadUser(job.user_id);
  const feature = features.getFeature(job.feature_id);

  db.prepare("UPDATE jobs SET status = 'running', updated_at = datetime('now') WHERE id = ?").run(job.id);

  if (!feature) {
    return fail(job, 'Fitur tidak ditemukan');
  }

  const provider = resolveProvider(feature, user);
  if (provider.name === 'unavailable') {
    return fail(job, 'Fitur ini butuh API key AI. Tambahkan di Pengaturan (OpenAI-compatible) atau isi OPENAI_API_KEY di server.');
  }

  try {
    let buffer;
    if (provider.name === 'pollinations') {
      buffer = await providers.pollinations({
        prompt: job.prompt,
        ratio: job.ratio,
        model: config.pollinationsModel,
      });
    } else {
      const images = loadImages(job);
      buffer = await providers.openaiCompat({
        feature,
        prompt: job.prompt,
        images,
        ratio: job.ratio,
        model: provider.model,
        apiKey: provider.apiKey,
        baseUrl: provider.baseUrl,
      });
    }

    const outDir = path.join(config.storageDir, 'results', String(job.user_id));
    fs.mkdirSync(outDir, { recursive: true });
    const filePath = path.join(outDir, `${job.id}.png`);
    fs.writeFileSync(filePath, buffer);

    db.prepare(
      "UPDATE jobs SET status = 'done', result_path = ?, provider = ?, model = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(filePath, provider.name, provider.model || job.model, job.id);
  } catch (err) {
    return fail(job, err.message || 'Gagal memproses');
  }
}

function fail(job, message) {
  db.prepare(
    "UPDATE jobs SET status = 'error', error = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(String(message).slice(0, 500), job.id);
  // Refund kredit job ini
  if (job.credit_cost > 0) {
    addCredit(job.user_id, job.credit_cost, 'refund', `Refund: gagal ${job.feature_id}`, job.id);
  }
}

function loadImages(job) {
  // Gambar input disimpan terpisah per job dalam JSON di kolom prompt? Tidak.
  // Gambar diambil dari uploads yang direferensikan batch ini.
  const batch = db.prepare('SELECT id FROM jobs WHERE batch_id = ? AND user_id = ?').all(job.batch_id, job.user_id);
  // Untuk MVP: job menyimpan input upload id di kolom error? Tidak - gunakan tabel terpisah.
  return batchUploads(job.batch_id, job.user_id);
}

// Batch menyimpan daftar upload id di sebuah tabel ringan.
function setBatchInputs(batchId, userId, uploadIds) {
  // Simpan sebagai baris di jobs dummy? Gunakan tabel uploads yang sudah ada:
  // relasi batch -> uploads disimpan via tabel job_inputs.
  const stmt = db.prepare('INSERT OR IGNORE INTO job_inputs (batch_id, user_id, upload_id) VALUES (?, ?, ?)');
  db.prepare('DELETE FROM job_inputs WHERE batch_id = ?').run(batchId);
  for (const id of uploadIds) stmt.run(batchId, userId, id);
}

function batchUploads(batchId, userId) {
  const rows = db.prepare(
    'SELECT u.path, u.mime FROM job_inputs ji JOIN uploads u ON u.id = ji.upload_id WHERE ji.batch_id = ? AND ji.user_id = ?'
  ).all(batchId, userId);
  return rows.map((r) => ({
    buffer: fs.readFileSync(r.path),
    mime: r.mime || 'image/png',
  }));
}

// ---- Public API untuk routes ----

// Buat batch job + potong kredit. returns { batchId, jobs }
function createBatch({ userId, featureId, formValues, images, ratio, count }) {
  const feature = features.getFeature(featureId);
  if (!feature) {
    const err = new Error('Fitur tidak ditemukan');
    err.status = 404;
    throw err;
  }
  const num = Math.max(1, Math.min(parseInt(count || '1', 10) || 1, 4));
  const cost = feature.creditCost * num;

  if (getCreditBalance(userId) < cost) {
    const err = new Error(`Kredit tidak cukup. Butuh ${cost}, saldo Anda ${getCreditBalance(userId)}.`);
    err.status = 402;
    err.code = 'INSUFFICIENT_CREDITS';
    err.required = cost;
    throw err;
  }

  const batchId = crypto.randomUUID();
  const prompt = features.buildPrompt(feature, formValues);
  const user = loadUser(userId);
  const provider = resolveProvider(feature, user);

  addCredit(userId, -cost, 'consume', `Generate ${feature.name} (${num}x)`, null);

  const insert = db.prepare(
    `INSERT INTO jobs (batch_id, user_id, feature_id, slot_index, status, prompt, provider, model, ratio, credit_cost)
     VALUES (?, ?, ?, ?, 'queued', ?, ?, ?, ?, ?)`
  );
  const jobIds = [];
  for (let i = 0; i < num; i++) {
    const res = insert.run(
      batchId,
      userId,
      featureId,
      i,
      prompt,
      provider.name,
      provider.model || '',
      ratio || '1:1',
      feature.creditCost
    );
    jobIds.push(res.lastInsertRowid);
  }

  // simpan input images (upload ids) untuk batch
  setBatchInputs(batchId, userId, images.filter(Boolean));

  // antre
  for (const id of jobIds) {
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
    queue.push(job);
  }
  kick();

  return { batchId, jobIds };
}

function getBatch(batchId, userId) {
  const rows = db
    .prepare('SELECT * FROM jobs WHERE batch_id = ? AND user_id = ? ORDER BY slot_index ASC')
    .all(batchId, userId);
  if (!rows.length) return null;
  return {
    batchId,
    featureId: rows[0].feature_id,
    status: rows.every((r) => r.status === 'done')
      ? 'done'
      : rows.some((r) => r.status === 'error' && !['done'].includes(r.status))
        ? 'error'
        : 'running',
    jobs: rows.map((r) => ({
      id: r.id,
      slotIndex: r.slot_index,
      status: r.status,
      error: r.error,
      prompt: r.prompt,
      ratio: r.ratio,
      resultUrl: r.result_path ? `/api/results/${r.id}/file` : null,
    })),
  };
}

function getJobFile(jobId, userId) {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ? AND user_id = ?').get(jobId, userId);
  if (!job || !job.result_path || !fs.existsSync(job.result_path)) return null;
  return { path: job.result_path, mime: job.result_mime || 'image/png' };
}

async function kick() {
  if (processing) return;
  processing = true;
  while (queue.length) {
    const job = queue.shift();
    try {
      await runJob(job);
    } catch (err) {
      try {
        fail(job, err.message || 'Gagal memproses');
      } catch { /* ignore */ }
    }
  }
  processing = false;
}

// Saat startup: tandai job menggantung dari proses sebelumnya.
function markStaleAsError() {
  const res = db.prepare("UPDATE jobs SET status = 'error', error = 'Server restart, silakan coba lagi', updated_at = datetime('now') WHERE status IN ('queued','running')").run();
  if (res.changes > 0) {
    const rows = db.prepare("SELECT DISTINCT user_id, credit_cost FROM jobs WHERE status = 'error' AND error = 'Server restart, silakan coba lagi'").all();
    // refund semua job yang tercatat error karena restart
    for (const row of rows) {
      addCredit(row.user_id, row.credit_cost, 'refund', 'Refund: server restart', null);
    }
  }
}

function history(userId, limit = 30) {
  const rows = db
    .prepare(
      `SELECT batch_id, feature_id, status, created_at, MAX(updated_at) as updated_at,
              COUNT(*) as total, SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done
       FROM jobs WHERE user_id = ? GROUP BY batch_id ORDER BY MAX(id) DESC LIMIT ?`
    )
    .all(userId, limit);
  return rows.map((r) => ({
    batchId: r.batch_id,
    featureId: r.feature_id,
    status: r.status,
    createdAt: r.created_at,
    total: r.total,
    done: r.done || 0,
  }));
}

module.exports = {
  createBatch,
  getBatch,
  getJobFile,
  history,
  addCredit,
  getCreditBalance,
  markStaleAsError,
};
