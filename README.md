<div align="center">

# ✨ Sulap Photo

**Edit & generate foto dengan AI — open source, gratis untuk memulai.**

Aplikasi web AI-photo: unggah foto, tulis deskripsi, biarkan AI mengerjakannya.
Terinspirasi dari konsep aplikasi AI-photo modern, dibangun untuk dipelajari, dipakai, dan dikembangkan bersama.

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node.js-22%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)](https://expressjs.com)
[![Vue](https://img.shields.io/badge/Vue-3-4FC08D?logo=vue.js&logoColor=white)](https://vuejs.org)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![SQLite](https://img.shields.io/badge/SQLite-built--in-003B57?logo=sqlite&logoColor=white)](https://nodejs.org/api/sqlite.html)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/masxsan/sulap-photo/pulls)

</div>

---

## 🚀 Highlight

| | |
|---|---|
| 🖼️ **Text ke Gambar** | Tulis deskripsi → AI membuatkan gambar. |
| 🎭 **Ubah Background** | Ganti latar foto dengan sekali prompt. |
| 🌦️ **Ubah Cuaca** | Cerah → hujan, salju, senja, atau malam berbintang. |
| 🎨 **Jadikan Kartun** | Anime, kartun 3D, cat air, pixel art, komik. |
| ⭐ **Foto Bareng Artis** | Berdiri "bersama" tokoh favoritmu. |
| 📸 **Pas Foto & Upscale HD** | Pas foto resmi + perbesar & pertajam hasil. |
| 🏠 **Desain Interior** | Lihat ruanganmu bergaya minimalis, mewah, dll. |
| 📢 **Poster, Banner & Logo** | Desain promosi dan logo siap pakai. |

Total **15 fitur AI** — semuanya didukung sistem **kredit** yang mudah dipahami, plus **provider AI yang bisa ditukar** — menggunakan engine gratis bawaan atau API key milik Anda sendiri.

## 🧱 Tech Stack

- **Backend:** Node.js, Express, SQLite (modul bawaan `node:sqlite` — tanpa dependency native)
- **Frontend:** Vue 3, Vite, Pinia, Vue Router, Tailwind CSS v4
- **Auth:** JWT + bcrypt
- **AI Provider:** Pollinations (gratis) & OpenAI-compatible (`images/generations` + `images/edits`)

## 📦 Prasyarat

- **Node.js ≥ 22.13** (menggunakan `node:sqlite`), disarankan LTS terbaru.
- npm (ikut terinstal bersama Node.js).

## ⚡ Quick Start

```bash
# 1. Clone
git clone https://github.com/masxsan/sulap-photo.git
cd sulap-photo

# 2. Install semua dependency
npm install
npm run setup

# 3. Konfigurasi
cp server/.env.example server/.env
#    lalu edit JWT_SECRET & ADMIN_API_KEY

# 4. Jalankan (server :5000 + client :5173)
npm run dev
```

Buka **http://localhost:5173** — daftar akun gratis dan langsung dapat bonus kredit.

> Mode produksi: `npm run build` lalu `npm start` → aplikasi lengkap di **http://localhost:5000**.

## 📁 Struktur Proyek

```
sulap-photo/
├── server/                  # Backend Express + SQLite
│   └── src/
│       ├── index.js         # Routes, upload, entry point
│       ├── config.js        # Baca konfigurasi .env
│       ├── db.js            # Schema SQLite (node:sqlite)
│       ├── auth.js          # JWT + bcrypt
│       ├── features.js      # Katalog fitur AI (uiSchema + prompt template)
│       ├── providers.js     # Provider AI (Pollinations & OpenAI-compatible)
│       └── jobs.js          # Job queue + pemrosesan generasi
└── client/                  # Frontend Vue 3 + Vite + Tailwind
    └── src/
        ├── views/           # Landing, Login, Dashboard, Feature, History, Settings
        ├── components/      # NavBar, FeatureForm, ResultPanel, ImageUploader, dll.
        ├── stores/          # Pinia (auth, catalog)
        └── api.js           # HTTP client
```

## 🔌 API Utama

| Method | Path | Auth | Keterangan |
|---|---|---|---|
| `POST` | `/api/auth/register` | — | Daftar akun → token JWT |
| `POST` | `/api/auth/login` | — | Login → token JWT |
| `GET` | `/api/me` | ✅ | Profil + saldo kredit |
| `PATCH` | `/api/me/provider` | ✅ | Simpan API key AI milik user |
| `GET` | `/api/features` | — | Katalog fitur AI |
| `POST` | `/api/uploads` | ✅ | Upload foto (multipart) |
| `POST` | `/api/generate` | ✅ | Buat batch generasi → `{batchId}` |
| `GET` | `/api/jobs/:batchId` | ✅ | Status & hasil generasi |
| `GET` | `/api/history` | ✅ | Riwayat generasi |
| `POST` | `/api/admin/credits` | `x-admin-key` | Top-up kredit pengguna |

Top-up kredit via admin:

```bash
curl -X POST http://localhost:5000/api/admin/credits \
  -H "x-admin-key: dev-admin-key" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@mail.com","amount":1000,"note":"Top up"}'
```

## 🛠️ Konfigurasi (`server/.env`)

| Variabel | Default | Keterangan |
|---|---|---|
| `PORT` | `5000` | Port server |
| `JWT_SECRET` | — | ⚠️ **Wajib ganti** di produksi |
| `FREE_CREDITS` | `500` | Kredit gratis saat daftar |
| `DEFAULT_PROVIDER` | `pollinations` | Provider default |
| `OPENAI_API_KEY` | — | API key global (opsional) |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | Endpoint OpenAI-compatible |
| `OPENAI_MODEL` | `gpt-image-1` | Model default |
| `POLLINATIONS_MODEL` | `flux` | Model gratis Pollinations |
| `ADMIN_API_KEY` | — | Untuk top-up kredit via API |
| `MAX_UPLOAD_MB` | `10` | Batas ukuran upload |

## 🧩 Menambah Fitur AI Baru

Cukup tambahkan objek ke `server/src/features.js` — form otomatis terbentuk dari `uiSchema`:

```js
{
  id: 'foto-ninja',
  name: 'Foto Ninja',
  category: 'kreatif',
  icon: 'sparkles',               // dari client/src/components/AppIcon.vue
  type: 'img2img',                // 'txt2img' atau 'img2img'
  creditCost: 10,
  description: 'Ubah foto jadi karakter ninja.',
  promptTemplate: 'Ubah orang di foto ini menjadi ninja dengan {latar}...',
  uiSchema: [
    { type: 'IMAGE_UPLOAD', id: 'photo', label: 'Foto Anda', required: true },
    { type: 'TEXTAREA', id: 'latar', label: 'Latar', required: true, rows: 2 },
    { type: 'SEGMENTED_CONTROL', id: 'gaya', label: 'Gaya', defaultValue: 'modern',
      options: [
        { value: 'modern', label: 'Modern' },
        { value: 'klasik', label: 'Klasik' },
      ] },
  ],
}
```

Jenis field: `TEXT`, `TEXTAREA`, `IMAGE_UPLOAD`, `SEGMENTED_CONTROL`.

Ingin provider AI baru? Tambahkan fungsi di `server/src/providers.js` bertanda tangan
`generate({ feature, prompt, images, ratio, model, ... }) → Buffer`, lalu daftarkan di
`resolveProvider()` pada `server/src/jobs.js`.

## ⚠️ Catatan MVP

- Antrean job berjalan in-memory — server restart menandai job berjalan sebagai gagal dan **mengembalikan kredit**.
- Belum ada watermark, tier langganan, maupun payment gateway (top-up dilakukan admin via API).
- Perfect untuk belajar & dikembangkan — PR sangat disambut! 🙌

## 📄 Lisensi

[MIT](LICENSE) — bebas dipakai, dimodifikasi, dan disebarluaskan.
