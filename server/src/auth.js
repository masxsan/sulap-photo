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
    providerConfigured: !!(row.provider_key || config.openaiApiKey),
    provider: row.provider_key ? 'user' : config.defaultProvider,
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
