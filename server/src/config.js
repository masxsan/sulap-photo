const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

function bool(v, def = false) {
  if (v === undefined || v === '') return def;
  return v === 'true' || v === '1';
}

const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  databasePath: path.resolve(__dirname, '..', process.env.DATABASE_PATH || './data/sulap-photo.sqlite'),
  storageDir: path.resolve(__dirname, '..', process.env.STORAGE_DIR || './storage'),
  freeCredits: parseInt(process.env.FREE_CREDITS || '500', 10),
  defaultProvider: process.env.DEFAULT_PROVIDER || 'pollinations',
  openaiBaseUrl: (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, ''),
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-image-1',
  pollinationsModel: process.env.POLLINATIONS_MODEL || 'flux',
  adminApiKey: process.env.ADMIN_API_KEY || '',
  maxUploadMb: parseInt(process.env.MAX_UPLOAD_MB || '10', 10),
};

module.exports = config;
