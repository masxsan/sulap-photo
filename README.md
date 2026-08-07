# Sulap Photo ✨

Aplikasi web **edit & generate foto dengan AI** — open source, terinspirasi dari konsep aplikasi AI-photo
seperti Mantra Foto. Dibangun dengan **Node.js + Express** (backend), **Vue 3 + Vite** (frontend), dan
**SQLite** (database, memakai modul bawaan `node:sqlite` — tanpa dependency native).

## Fitur

- 🔐 **Auth** — register & login (JWT), password di-hash (bcrypt).
- 💰 **Sistem kredit** — bonus kredit saat daftar, biaya per generasi, riwayat transaksi, top-up via API admin.
- 🎨 **Katalog fitur AI** berbasis *uiSchema* — tambah fitur baru cukup edit satu file JSON.
  - Text ke Gambar, Ubah Background, Foto Studio Pro, Filter Umur, Ubah Ekspresi, Poster & Flyer, Banner Iklan.
- 🤖 **Dua provider AI** (mudah ditambah yang lain):
  - **Pollinations.ai** — gratis, tanpa API key (hanya fitur berbasis teks).
  - **OpenAI-compatible** — `images/generations` (txt2img) & `images/edits` (img2img) untuk
    fitur berbasis foto. Cocok dengan OpenAI, SiliconFlow, OpenRouter, atau server lokal yang kompatibel.
- 🖼️ **Upload foto** (max 10MB) + pipeline job + polling status, hasil tersimpan di server.
- 📱 **Frontend SPA** — dashboard, halaman fitur generik (form otomatis dari uiSchema), riwayat, pengaturan.

## Struktur Proyek

```
server/            # Backend Express + SQLite
  src/
    index.js       # Entry: routes, upload, auth
    config.js      # Baca .env
    db.js          # Schema SQLite (node:sqlite)
    auth.js        # JWT + bcrypt
    features.js    # Katalog fitur AI (uiSchema + prompt template)
    providers.js   # Provider: Pollinations & OpenAI-compatible
    jobs.js        # Job queue + pemrosesan generasi
client/            # Frontend Vue 3 + Vite + Tailwind
  src/
    views/         # Landing, Login, Register, Dashboard, Feature, History, Settings
    components/    # NavBar, FeatureForm, ResultPanel, ImageUploader, dll.
    stores/        # Pinia: auth, catalog
    api.js         # HTTP client
```

## Prasyarat

- **Node.js ≥ 22.13** (dipakai `node:sqlite`). Disarankan LTS terbaru.
- npm (ikut terinstal bersama Node.js).

## Menjalankan

```bash
npm install                  # install concurrently (root)
npm run setup                # install server & client
cp server/.env.example server/.env   # lalu edit sesuai kebutuhan
npm run dev                  # jalankan server (5000) + client (5173) sekaligus
```

Buka <http://localhost:5173>. Semua permintaan `/api` diproxy Vite ke server.

Mode produksi:

```bash
npm run build                # build frontend ke client/dist
npm start                    # server menyajikan frontend di http://localhost:5000
```

## Konfigurasi (`server/.env`)

| Variabel | Default | Keterangan |
|---|---|---|
| `PORT` | `5000` | Port server |
| `JWT_SECRET` | — | **Wajib ganti** di produksi |
| `FREE_CREDITS` | `500` | Kredit gratis saat daftar |
| `DEFAULT_PROVIDER` | `pollinations` | Provider default |
| `OPENAI_API_KEY` | — | API key global (opsional, dipakai bila user tak punya key sendiri) |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | Endpoint OpenAI-compatible |
| `OPENAI_MODEL` | `gpt-image-1` | Model default |
| `POLLINATIONS_MODEL` | `flux` | Model gratis Pollinations |
| `ADMIN_API_KEY` | — | Untuk top-up kredit via API |
| `MAX_UPLOAD_MB` | `10` | Batas ukuran upload |

## API

| Method | Path | Auth | Keterangan |
|---|---|---|---|
| POST | `/api/auth/register` | — | Daftar `{name,email,password}` → token |
| POST | `/api/auth/login` | — | Login → token |
| GET | `/api/me` | ✅ | Data user + kredit |
| PATCH | `/api/me/provider` | ✅ | Simpan API key user `{apiKey,baseUrl,model}` |
| GET | `/api/features` | — | Katalog fitur |
| POST | `/api/uploads` | ✅ | Upload gambar (multipart `file`) → `{id}` |
| POST | `/api/generate` | ✅ | `{featureId,formValues,images,ratio,count}` → `{batchId}` |
| GET | `/api/jobs/:batchId` | ✅ | Status batch + hasil |
| GET | `/api/results/:jobId/file` | ✅ | File gambar hasil |
| GET | `/api/history` | ✅ | Riwayat batch |
| GET | `/api/wallet/transactions` | ✅ | Riwayat kredit |
| POST | `/api/admin/credits` | header `x-admin-key` | Top-up kredit user `{email,amount,note}` |

Contoh top-up admin:

```bash
curl -X POST http://localhost:5000/api/admin/credits \
  -H "x-admin-key: dev-admin-key" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@mail.com","amount":1000,"note":"Top up"}'
```

## Menambah Fitur AI Baru

Edit `server/src/features.js` — tambah objek ke array `features`:

```js
{
  id: 'foto-ninja',
  name: 'Foto Ninja',
  category: 'kreatif',
  icon: 'sparkles',            // ikon dari client/src/components/AppIcon.vue
  type: 'img2img',             // 'txt2img' tanpa foto, 'img2img' butuh 1 foto
  creditCost: 10,
  description: 'Ubah foto jadi karakter ninja.',
  promptTemplate: 'Ubah orang di foto ini menjadi ninja dengan {latar}...',
  uiSchema: [
    { type: 'IMAGE_UPLOAD', id: 'photo', label: 'Foto Anda', required: true },
    { type: 'TEXTAREA', id: 'latar', label: 'Latar', required: true, rows: 2 },
    { type: 'SEGMENTED_CONTROL', id: 'gaya', label: 'Gaya', defaultValue: 'modern',
      options: [ { value: 'modern', label: 'Modern' }, { value: 'klasik', label: 'Klasik' } ] },
  ],
}
```

Jenis field yang didukung: `TEXT`, `TEXTAREA`, `IMAGE_UPLOAD`, `SEGMENTED_CONTROL`.

## Menambah Provider AI Baru

Buat fungsi di `server/src/providers.js` dengan tanda tangan
`generate({ feature, prompt, images, ratio, model, ... })` → `Buffer` gambar,
lalu daftarkan di `resolveProvider()` pada `server/src/jobs.js`.

## Catatan & Batasan MVP

- Antrean job berjalan in-memory — bila server restart, job yang belum selesai ditandai error dan kredit direfund.
- Tidak ada watermark & tier langganan (fokus MVP: kredit sederhana).
- Tidak ada payment gateway — top-up kredit dilakukan admin via API.

## Lisensi

MIT — bebas dipakai, dimodifikasi, dan disebarluaskan.
