const db = require('./db');
const { addCredit, getCreditBalance } = require('./jobs');
const { publicUser } = require('./auth');

const THEMES = [
  { id: 'light', name: 'Terang', icon: 'sun', price: 0, description: 'Tema default yang cerah dan bersih.' },
  { id: 'dark', name: 'Gelap', icon: 'moon', price: 0, description: 'Tampilan gelap yang nyaman di mata.' },
  { id: 'sakura', name: 'Sakura', icon: 'flower', price: 5000, description: 'Kelopak sakura berjatuhan lembut.' },
  { id: 'winter', name: 'Musim Dingin', icon: 'snowflake', price: 5000, description: 'Salju turun perlahan di latar es.' },
  { id: 'autumn', name: 'Musim Gugur', icon: 'leaf', price: 5000, description: 'Daun gugur berwarna hangat.' },
  { id: 'galaxy', name: 'Galaksi', icon: 'rocket', price: 5000, description: 'Bintang berkelip di angkasa malam.' },
  { id: 'rainy', name: 'Hujan', icon: 'cloud', price: 5000, description: 'Rintik hujan menenangkan.' },
  { id: 'cyberpunk', name: 'Cyberpunk', icon: 'cpu', price: 5000, description: 'Neon grid kota masa depan.' },
  { id: 'ninja', name: 'Ninja', icon: 'star', price: 5000, description: 'Shuriken melesat di kegelapan.' },
];

function getThemes() {
  return THEMES;
}

function getTheme(id) {
  return THEMES.find((t) => t.id === id) || null;
}

function parseOwned(row) {
  let arr = [];
  try {
    arr = JSON.parse(row.themes || '[]');
  } catch {
    arr = [];
  }
  return Array.isArray(arr) ? arr : [];
}

function ownedSet(userId) {
  const row = db.prepare('SELECT themes FROM users WHERE id = ?').get(userId);
  return new Set(row ? parseOwned(row) : []);
}

function listFor(userId) {
  const owned = ownedSet(userId);
  return {
    themes: THEMES.map((t) => ({ ...t, owned: owned.has(t.id) })),
  };
}

function purchase(userId, themeId) {
  const theme = getTheme(themeId);
  if (!theme) {
    const err = new Error('Tema tidak ditemukan');
    err.status = 404;
    throw err;
  }
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!row) {
    const err = new Error('Akun tidak ditemukan');
    err.status = 401;
    throw err;
  }
  const owned = parseOwned(row);
  if (owned.includes(themeId)) {
    const err = new Error('Tema sudah dimiliki');
    err.status = 409;
    throw err;
  }
  const balance = getCreditBalance(userId);
  if (balance < theme.price) {
    const err = new Error(`Kredit tidak cukup. Butuh ${theme.price}, saldo Anda ${balance}.`);
    err.status = 402;
    err.code = 'INSUFFICIENT_CREDITS';
    err.required = theme.price;
    throw err;
  }
  addCredit(userId, -theme.price, 'theme_purchase', `Beli tema ${theme.name}`, null);
  owned.push(themeId);
  db.prepare('UPDATE users SET themes = ? WHERE id = ?').run(JSON.stringify(owned), userId);
  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  return {
    user: publicUser(updated),
    themes: listFor(userId).themes,
  };
}

module.exports = { getThemes, getTheme, ownedSet, listFor, purchase };
