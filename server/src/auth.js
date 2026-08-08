const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('./config');

function sign(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    config.jwtSecret,
    { expiresIn: '30d' }
  );
}

function hashPassword(plain) {
  return bcrypt.hashSync(plain, 10);
}

function verifyPassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

function publicUser(row) {
  if (!row) return null;
  let themes = [];
  try {
    themes = JSON.parse(row.themes || '[]');
  } catch {
    themes = [];
  }
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    credits: row.credits,
    themes: Array.isArray(themes) ? themes : [],
    useFreeTxt: !!row.use_free_txt,
    provider: row.provider || config.defaultProvider,
    providerEnabled: row.provider_enabled !== 0,
    providerModel: row.provider_model || '',
    providerModelText: row.provider_model_text || '',
    providerModelImage: row.provider_model_image || '',
    providerModelEditing: row.provider_model_editing || '',
    providerBaseUrl: row.provider_base_url || '',
    providerConfigured: !!(row.provider_key || config.openaiApiKey),
    // Status/kesehatan API key provider (untuk dashboard Settings).
    providerStatus: row.provider_status || '',
    lastTestedAt: row.last_tested_at || '',
    lastSuccessAt: row.last_success_at || '',
    lastErrorCode: row.last_error_code || '',
    lastErrorMessage: row.last_error_message || '',
    cooldownUntil: row.cooldown_until || '',
    lastModelsSync: row.last_models_sync || '',
    createdAt: row.created_at,
  };
}

// Express middleware: requires a valid Bearer token
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Tidak terautentikasi' });
  try {
    req.user = jwt.verify(token, config.jwtSecret);
    next();
  } catch {
    return res.status(401).json({ error: 'Sesi tidak valid atau sudah kedaluwarsa' });
  }
}

// Optional: populates req.user when token is present
function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (token) {
    try {
      req.user = jwt.verify(token, config.jwtSecret);
    } catch {
      /* ignore */
    }
  }
  next();
}

module.exports = { sign, hashPassword, verifyPassword, publicUser, requireAuth, optionalAuth };
