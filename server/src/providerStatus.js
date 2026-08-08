// Persist status API key provider + log request aman (tanpa API key).
// Dipakai oleh index.js (test/discovery) dan jobs.js (generate).

const db = require('./db');

// Simpan status provider user + timestamps. status: '' | ACTIVE | RATE_LIMIT |
// QUOTA_EXCEEDED | INVALID_KEY | MODEL_UNAVAILABLE | TEMPORARY_ERROR.
function setProviderStatus(userId, { status = '', errorCode = '', errorMessage = '', success = false, cooldownSeconds = 0 }) {
  const now = new Date().toISOString();
  const cooldownUntil = cooldownSeconds > 0 ? new Date(Date.now() + cooldownSeconds * 1000).toISOString() : '';
  const sets = ['last_tested_at = ?'];
  const vals = [now];
  if (status) { sets.push('provider_status = ?'); vals.push(status); }
  if (success) { sets.push('last_success_at = ?'); vals.push(now); }
  if (errorCode) { sets.push('last_error_code = ?'); vals.push(String(errorCode).slice(0, 80)); }
  if (errorMessage) { sets.push('last_error_message = ?'); vals.push(String(errorMessage).slice(0, 500)); }
  if (cooldownSeconds > 0) { sets.push('cooldown_until = ?'); vals.push(cooldownUntil); }
  else { sets.push("cooldown_until = ''"); }
  db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...vals, userId);
}

// Detik tersisa cooldown untuk user (0 = tidak ada cooldown aktif).
function cooldownRemainingSeconds(user) {
  if (!user?.cooldown_until) return 0;
  const until = new Date(user.cooldown_until).getTime();
  if (!Number.isFinite(until)) return 0;
  const remaining = Math.ceil((until - Date.now()) / 1000);
  return remaining > 0 ? remaining : 0;
}

// Hapus cooldown bila sudah lewat (dipanggil sebelum generate/test).
function clearExpiredCooldown(user) {
  if (cooldownRemainingSeconds(user) === 0 && user?.cooldown_until) {
    db.prepare("UPDATE users SET cooldown_until = '' WHERE id = ?").run(user.id);
  }
}

// Tulis log request AI aman: TIDAK pernah menyimpan API key.
function logRequest({ userId, provider, model, status, errorCode = '', errorMessage = '', retried = 0, cooldownSeconds = 0 }) {
  try {
    db.prepare(
      `INSERT INTO api_request_logs (user_id, provider, model, status, error_code, error_message, retried, cooldown_seconds)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      userId || 0,
      String(provider || '').slice(0, 40),
      String(model || '').slice(0, 120),
      Number(status) || 0,
      String(errorCode || '').slice(0, 80),
      String(errorMessage || '').slice(0, 300),
      Number(retried) || 0,
      Number(cooldownSeconds) || 0
    );
  } catch { /* log tidak boleh menggagalkan request utama */ }
}

module.exports = { setProviderStatus, cooldownRemainingSeconds, clearExpiredCooldown, logRequest };
