// Katalog fitur AI. Tambahkan fitur baru cukup dengan menambah objek di sini.
// `type`: 'txt2img' (teks saja) | 'img2img' (butuh 1 foto input)
// `uiSchema`: daftar field form. Jenis field:
//   TEXT, TEXTAREA, IMAGE_UPLOAD, SEGMENTED_CONTROL (options), SELECT
// `promptTemplate`: {fieldId} akan diganti dengan nilai field yang terisi.

const categories = [
  { id: 'generator', name: 'AI Generator', color: '#F97316' },
  { id: 'studio', name: 'Foto Profesional', color: '#8B5CF6' },
  { id: 'kreatif', name: 'Kenangan & Kreatif', color: '#EC4899' },
  { id: 'marketing', name: 'Produk & Marketing', color: '#10B981' },
];

const features = [
  {
    id: 'text-to-gambar',
    name: 'Text ke Gambar',
    category: 'generator',
    icon: 'sparkles',
    type: 'txt2img',
    creditCost: 10,
    description: 'Tulis deskripsi apa pun, dan AI akan membuatkan gambarnya.',
    promptTemplate: '{prompt}',
    uiSchema: [
      { type: 'TEXTAREA', id: 'prompt', label: 'Deskripsi Gambar', placeholder: 'Contoh: seekor kucing oranye memakai topi astronaut di luar angkasa, cinematic lighting', required: true, rows: 3 },
    ],
  },
  {
    id: 'ubah-background',
    name: 'Ubah Background',
    category: 'studio',
    icon: 'image',
    type: 'img2img',
    creditCost: 10,
    description: 'Unggah foto, lalu ganti latar belakangnya dengan deskripsi Anda.',
    promptTemplate: 'Ganti latar belakang foto ini dengan: {prompt}. Pertahankan subjek dan pencahayaan agar terlihat natural.',
    uiSchema: [
      { type: 'IMAGE_UPLOAD', id: 'photo', label: 'Foto Anda', required: true },
      { type: 'TEXTAREA', id: 'prompt', label: 'Background Baru', placeholder: 'Contoh: pantai saat matahari terbenam, langit oranye, ombak lembut', required: true, rows: 2 },
    ],
  },
  {
    id: 'foto-studio',
    name: 'Foto Studio Pro',
    category: 'studio',
    icon: 'camera',
    type: 'img2img',
    creditCost: 10,
    description: 'Ubah foto biasa menjadi hasil studio profesional.',
    promptTemplate: 'Transformasikan foto ini menjadi foto studio profesional: {prompt}. Lighting studio, high detail, sharp focus.',
    uiSchema: [
      { type: 'IMAGE_UPLOAD', id: 'photo', label: 'Foto Anda', required: true },
      { type: 'TEXT', id: 'prompt', label: 'Gaya', placeholder: 'Contoh: golden hour, latar hitam, dramatic', required: true },
    ],
  },
  {
    id: 'filter-umur',
    name: 'Filter Umur',
    category: 'kreatif',
    icon: 'users',
    type: 'img2img',
    creditCost: 10,
    description: 'Lihat wajah Anda atau teman di usia yang berbeda.',
    promptTemplate: 'Buat foto orang di foto ini terlihat sebagai {usia}. Pertahankan identitas wajah yang sama. Photorealistic.',
    uiSchema: [
      { type: 'IMAGE_UPLOAD', id: 'photo', label: 'Foto Wajah', required: true },
      {
        type: 'SEGMENTED_CONTROL', id: 'usia', label: 'Usia Target', defaultValue: 'anak kecil',
        options: [
          { value: 'anak kecil', label: 'Anak' },
          { value: 'remaja', label: 'Remaja' },
          { value: 'dewasa muda', label: 'Dewasa' },
          { value: 'orang tua 60 tahun', label: 'Lansia' },
        ],
      },
    ],
  },
  {
    id: 'ubah-ekspresi',
    name: 'Ubah Ekspresi',
    category: 'kreatif',
    icon: 'smile',
    type: 'img2img',
    creditCost: 10,
    description: 'Ubah ekspresi wajah pada foto.',
    promptTemplate: 'Ubah ekspresi wajah pada foto ini menjadi: {ekspresi}. Pertahankan identitas wajah. Photorealistic.',
    uiSchema: [
      { type: 'IMAGE_UPLOAD', id: 'photo', label: 'Foto Wajah', required: true },
      {
        type: 'SEGMENTED_CONTROL', id: 'ekspresi', label: 'Ekspresi', defaultValue: 'tersenyum lebar',
        options: [
          { value: 'tersenyum lebar', label: 'Senyum' },
          { value: 'tertawa bahagia', label: 'Tertawa' },
          { value: 'serius dan tenang', label: 'Serius' },
          { value: 'melamun romantis', label: 'Melamun' },
        ],
      },
    ],
  },
  {
    id: 'poster-flyer',
    name: 'Poster & Flyer',
    category: 'marketing',
    icon: 'megaphone',
    type: 'txt2img',
    creditCost: 15,
    description: 'Buat desain poster/flyer promosi dari deskripsi.',
    promptTemplate:
      'Desain poster promosi modern yang menarik. Judul: "{judul}". Detail: {prompt}. Komposisi bersih, teks terbaca jelas, tipografi profesional.',
    uiSchema: [
      { type: 'TEXT', id: 'judul', label: 'Judul Poster', placeholder: 'Contoh: DISKON 50%', required: true },
      { type: 'TEXTAREA', id: 'prompt', label: 'Detail Desain', placeholder: 'Contoh: gelap elegan dengan aksen emas, produk sepatu di tengah', required: true, rows: 2 },
    ],
  },
  {
    id: 'buat-banner',
    name: 'Banner Iklan',
    category: 'marketing',
    icon: 'layout',
    type: 'txt2img',
    creditCost: 15,
    description: 'Buat banner iklan dengan rasio lebar untuk media sosial.',
    promptTemplate: 'Buat banner iklan menarik: {prompt}. Elemen besar, kontras tinggi, tanpa teks panjang.',
    uiSchema: [
      { type: 'TEXTAREA', id: 'prompt', label: 'Konsep Banner', placeholder: 'Contoh: promo kopi pagi, cangkir kopi dengan butiran biji kopi', required: true, rows: 2 },
    ],
  },
];

const byId = new Map(features.map((f) => [f.id, f]));

function getFeature(id) {
  return byId.get(id) || null;
}

function getFeatures() {
  return features;
}

function getCategories() {
  return categories;
}

// Bangun prompt akhir dari template + nilai form
function buildPrompt(feature, formValues) {
  let prompt = feature.promptTemplate || '';
  for (const field of feature.uiSchema || []) {
    const val = formValues[field.id];
    if (val === undefined || val === null || val === '') {
      prompt = prompt.replace(new RegExp(`\\{${field.id}\\}`, 'g'), '');
      continue;
    }
    let text = String(val);
    if (field.options) {
      const opt = field.options.find((o) => o.value === val);
      if (opt && opt.prompt) text = opt.prompt;
    }
    prompt = prompt.replace(new RegExp(`\\{${field.id}\\}`, 'g'), text);
  }
  return prompt.replace(/\s{2,}/g, ' ').trim();
}

module.exports = { getFeature, getFeatures, getCategories, buildPrompt };
