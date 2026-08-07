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
  {
    id: 'ubah-cuaca',
    name: 'Ubah Cuaca',
    category: 'kreatif',
    icon: 'cloud',
    type: 'img2img',
    creditCost: 10,
    description: 'Ubah suasana foto dari cerah jadi hujan, salju, senja, dan lainnya.',
    promptTemplate: 'Ubah cuaca pada foto ini menjadi {cuaca}. Pertahankan komposisi dan subjek, buat pencahayaan sesuai suasana, photorealistic.',
    uiSchema: [
      { type: 'IMAGE_UPLOAD', id: 'photo', label: 'Foto Anda', required: true },
      {
        type: 'SEGMENTED_CONTROL', id: 'cuaca', label: 'Suasana', defaultValue: 'cerah ceria',
        options: [
          { value: 'cerah ceria', label: 'Cerah' },
          { value: 'hujan lebat dengan awan mendung', label: 'Hujan' },
          { value: 'bersalju', label: 'Salju' },
          { value: 'berkabut misterius', label: 'Kabut' },
          { value: 'senja keemasan', label: 'Senja' },
          { value: 'malam berbintang', label: 'Malam' },
        ],
      },
    ],
  },
  {
    id: 'foto-kartun',
    name: 'Jadikan Kartun',
    category: 'kreatif',
    icon: 'star',
    type: 'img2img',
    creditCost: 10,
    description: 'Ubah foto menjadi kartun, anime, lukisan, atau pixel art.',
    promptTemplate: 'Ubah foto ini menjadi {gaya}. Detail karakter ekspresif, warna cerah dan konsisten.',
    uiSchema: [
      { type: 'IMAGE_UPLOAD', id: 'photo', label: 'Foto Anda', required: true },
      {
        type: 'SEGMENTED_CONTROL', id: 'gaya', label: 'Gaya', defaultValue: 'kartun animasi 3D',
        options: [
          { value: 'kartun animasi 3D', label: 'Kartun 3D' },
          { value: 'anime Jepang', label: 'Anime' },
          { value: 'lukisan cat air', label: 'Cat Air' },
          { value: 'pixel art retro', label: 'Pixel Art' },
          { value: 'komik buku', label: 'Komik' },
          { value: 'sketsa pensil', label: 'Sketsa' },
        ],
      },
    ],
  },
  {
    id: 'foto-bareng-artis',
    name: 'Foto Bareng Artis',
    category: 'kreatif',
    icon: 'users',
    type: 'img2img',
    creditCost: 15,
    description: 'Berdirilah "bersama" artis atau tokoh favorit dalam satu foto.',
    promptTemplate: 'Buat orang di foto ini berdiri di samping {artis}. Pencahayaan serasi, ekspresi natural, foto candid, photorealistic.',
    uiSchema: [
      { type: 'IMAGE_UPLOAD', id: 'photo', label: 'Foto Anda', required: true },
      { type: 'TEXT', id: 'artis', label: 'Artis / Tokoh', placeholder: 'Contoh: Messi, Ronaldo, Tulus', required: true },
    ],
  },
  {
    id: 'pas-foto',
    name: 'Pas Foto',
    category: 'studio',
    icon: 'camera',
    type: 'img2img',
    creditCost: 10,
    description: 'Buat pas foto resmi dengan latar polos dan komposisi formal.',
    promptTemplate: 'Ubah foto ini menjadi pas foto resmi: latar {latar}, wajah menghadap depan, ekspresi netral, pencahayaan studio merata, tanpa aksesori berlebih.',
    uiSchema: [
      { type: 'IMAGE_UPLOAD', id: 'photo', label: 'Foto Wajah', required: true },
      {
        type: 'SEGMENTED_CONTROL', id: 'latar', label: 'Latar', defaultValue: 'putih polos',
        options: [
          { value: 'putih polos', label: 'Putih' },
          { value: 'biru muda polos', label: 'Biru' },
          { value: 'merah polos', label: 'Merah' },
        ],
      },
    ],
  },
  {
    id: 'upscale-hd',
    name: 'Upscale HD',
    category: 'studio',
    icon: 'image',
    type: 'img2img',
    creditCost: 15,
    description: 'Perbesar dan pertajam foto agar tampak beresolusi tinggi.',
    promptTemplate: 'Upscale foto ini menjadi resolusi tinggi 4x. Detail kulit, tekstur, dan tepian tajam tanpa artefak. Pertahankan komposisi persis.',
    uiSchema: [
      { type: 'IMAGE_UPLOAD', id: 'photo', label: 'Foto Anda', required: true },
    ],
  },
  {
    id: 'desain-rumah',
    name: 'Desain Interior',
    category: 'studio',
    icon: 'home',
    type: 'img2img',
    creditCost: 15,
    description: 'Lihat bagaimana ruanganmu tampil dengan gaya desain berbeda.',
    promptTemplate: 'Redesain interior ruangan pada foto ini menjadi gaya {gaya}. Pencahayaan alami, furnitur proporsional, render arsitektur realistis.',
    uiSchema: [
      { type: 'IMAGE_UPLOAD', id: 'photo', label: 'Foto Ruangan', required: true },
      {
        type: 'SEGMENTED_CONTROL', id: 'gaya', label: 'Gaya Desain', defaultValue: 'minimalis modern',
        options: [
          { value: 'minimalis modern', label: 'Minimalis' },
          { value: 'skandinavia terang', label: 'Skandinavia' },
          { value: 'industrial loft', label: 'Industrial' },
          { value: 'klasik mewah', label: 'Mewah' },
          { value: 'tropis segar', label: 'Tropis' },
        ],
      },
    ],
  },
  {
    id: 'produk-katalog',
    name: 'Foto Produk Katalog',
    category: 'marketing',
    icon: 'layout',
    type: 'img2img',
    creditCost: 15,
    description: 'Ubah foto produk biasa jadi tampilan katalog profesional.',
    promptTemplate: 'Ubah foto produk ini menjadi foto katalog profesional: {latar}. Detail produk tajam, pencahayaan studio, proporsi benar.',
    uiSchema: [
      { type: 'IMAGE_UPLOAD', id: 'photo', label: 'Foto Produk', required: true },
      {
        type: 'SEGMENTED_CONTROL', id: 'latar', label: 'Tampilan', defaultValue: 'latar putih bersih',
        options: [
          { value: 'latar putih bersih', label: 'Putih' },
          { value: 'gradasi lembut pastel', label: 'Pastel' },
          { value: 'latar outdoor natural', label: 'Outdoor' },
          { value: 'showcase kaca minimalis', label: 'Showcase' },
        ],
      },
    ],
  },
  {
    id: 'logo-text',
    name: 'Logo dari Teks',
    category: 'marketing',
    icon: 'diamond',
    type: 'txt2img',
    creditCost: 15,
    description: 'Buat desain logo untuk brand atau usaha Anda.',
    promptTemplate: 'Buat logo minimalis untuk brand "{merek}": {deskripsi}. Flat vector design, bersih, skala monokrom dan warna, tanpa teks selain nama brand.',
    uiSchema: [
      { type: 'TEXT', id: 'merek', label: 'Nama Brand', placeholder: 'Contoh: Kopi Senja', required: true },
      { type: 'TEXTAREA', id: 'deskripsi', label: 'Konsep / Simbol', placeholder: 'Contoh: ikon cangkir kopi dengan matahari terbenam', required: true, rows: 2 },
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
