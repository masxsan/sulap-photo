const crypto = require('crypto');
const config = require('./config');

// Enkripsi API key saat disimpan di DB agar tidak tersimpan plaintext.
// Menggunakan AES-256-GCM dengan key turunan dari JWT_SECRET.
const PREFIX = 'enc:v1:';

function deriveKey() {
  return crypto.createHash('sha256').update(String(config.jwtSecret || 'dev-secret')).digest();
}

function encryptKey(plain) {
  if (!plain) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, enc]).toString('base64');
}

function decryptKey(stored) {
  if (!stored) return '';
  if (!stored.startsWith(PREFIX)) return stored; // nilai lama (plaintext) biarkan apa adanya
  try {
    const raw = Buffer.from(stored.slice(PREFIX.length), 'base64');
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const data = raw.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

module.exports = { encryptKey, decryptKey };
