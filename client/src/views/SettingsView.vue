<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { api } from '../api';
import { useAuthStore } from '../stores/auth';
import NavBar from '../components/NavBar.vue';
import AppIcon from '../components/AppIcon.vue';

const auth = useAuthStore();
const providers = ref([]);
const provider = ref('');
const apiKey = ref('');
const baseUrl = ref('');
// Model default per kategori (satu API key, banyak model).
const modelText = ref('');
const modelImage = ref('');
const modelEditing = ref('');
const enabled = ref(true);
const useFreeTxt = ref(false);
const transactions = ref([]);
const saving = ref(false);
const saved = ref(false);
const message = ref('');
const error = ref('');
const testing = ref(false);
const testResult = ref(null);
const modelOptions = ref([]);
const modelsLoading = ref(false);
const modelsMsg = ref('');
// Status API key provider (dashboard Settings): dari GET /api/me/provider/status.
const providerStatus = ref(null);
const cooldownLeft = ref(0);
let cooldownTimer = null;

const statusInfo = computed(() => {
  const map = {
    ACTIVE: { emoji: '🟢', color: 'text-emerald-600', label: 'API Key Aktif', detail: 'Koneksi Gemini berhasil.' },
    RATE_LIMIT: { emoji: '🟡', color: 'text-amber-500', label: 'Rate Limit', detail: 'API sedang terkena batas request. Silakan tunggu beberapa saat.' },
    QUOTA_EXCEEDED: { emoji: '🔴', color: 'text-red-600', label: 'Quota Terlampaui', detail: 'Quota API Gemini untuk request ini telah mencapai batas.' },
    INVALID_KEY: { emoji: '🔴', color: 'text-red-600', label: 'API Key Tidak Valid', detail: 'Periksa kembali API Key Google AI Studio.' },
    MODEL_UNAVAILABLE: { emoji: '🟠', color: 'text-orange-500', label: 'Model Tidak Tersedia', detail: 'Model ini tidak dapat digunakan oleh API/project saat ini.' },
    TEMPORARY_ERROR: { emoji: '⚠️', color: 'text-amber-500', label: 'Gangguan Sementara', detail: 'Server Gemini sedang mengalami gangguan sementara. Silakan coba lagi nanti.' },
    UNKNOWN: { emoji: '⚪', color: 'text-slate-400', label: 'Belum Dites', detail: 'Belum ada pengujian untuk API key ini.' },
  };
  const key = providerStatus.value?.status || 'UNKNOWN';
  return map[key] || map.UNKNOWN;
});

// Format timestamp ISO -> teks relatif "2 menit lalu".
function timeAgo(iso) {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '—';
  const diff = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (diff < 60) return `${diff} detik lalu`;
  if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  return `${Math.floor(diff / 86400)} hari lalu`;
}

function startCooldownTimer(seconds) {
  stopCooldownTimer();
  cooldownLeft.value = seconds;
  cooldownTimer = setInterval(() => {
    cooldownLeft.value = Math.max(0, cooldownLeft.value - 1);
    if (cooldownLeft.value <= 0) stopCooldownTimer();
  }, 1000);
}
function stopCooldownTimer() {
  if (cooldownTimer) { clearInterval(cooldownTimer); cooldownTimer = null; }
}

async function fetchProviderStatus() {
  try {
    const d = await api.get('/me/provider/status');
    providerStatus.value = d;
    if (d.cooldownSeconds > 0) startCooldownTimer(d.cooldownSeconds);
    else stopCooldownTimer();
  } catch { /* ignore */ }
}

const activeProvider = computed(() => providers.value.find((p) => p.id === provider.value) || null);

// Daftar model per capability (hanya model yang tersedia sekarang).
const textModels = computed(() => modelOptions.value.filter((m) => m.available !== false && m.supportsText));
const imageModels = computed(() => modelOptions.value.filter((m) => m.available !== false && m.supportsImageOutput));
const editingModels = computed(() => modelOptions.value.filter((m) => m.available !== false && m.supportsImageEditing));

// Model terpilih yang tidak ada lagi di daftar hasil discovery (sudah tidak tersedia).
const unavailableModels = computed(() => {
  const names = new Set(modelOptions.value.map((m) => m.name));
  return [modelText.value, modelImage.value, modelEditing.value].filter((v) => v && !names.has(v));
});

function applyUser() {
  const u = auth.user;
  if (!u) return;
  provider.value = u.provider || 'pollinations';
  enabled.value = u.providerEnabled !== false;
  baseUrl.value = u.providerBaseUrl || '';
  modelText.value = u.providerModelText || '';
  modelImage.value = u.providerModelImage || u.providerModel || '';
  modelEditing.value = u.providerModelEditing || '';
  useFreeTxt.value = !!u.useFreeTxt;
  apiKey.value = ''; // key tidak pernah dikembalikan ke client
}

// Isi daftar model dropdown. Prioritas: hasil discovery API (dinamis). Bila kosong,
// pakai daftar statis provider. Model tersimpan disisipkan tanpa duplikat.
function setModelOptions(dynamic) {
  const base = dynamic && dynamic.length ? [...dynamic] : [...(activeProvider.value?.models || [])];
  const seen = new Set(base.map((m) => m.name));
  for (const m of modelOptions.value) {
    if (m && m.name && !seen.has(m.name)) {
      base.push(m);
      seen.add(m.name);
    }
  }
  modelOptions.value = base;
}

async function loadModels({ force = false } = {}) {
  const p = activeProvider.value;
  if (!p || !p.requiresApiKey) return;
  // Cache model (point 15): bila masih baru (<10 menit) dan bukan force, pakai cache.
  if (!force && providerStatus.value?.lastModelsSync) {
    const ageMs = Date.now() - new Date(providerStatus.value.lastModelsSync).getTime();
    if (Number.isFinite(ageMs) && ageMs < 10 * 60 * 1000) {
      modelsMsg.value = '✓ Daftar model masih baru (cache). Tekan "↻ Refresh Models" untuk sinkron ulang.';
      return;
    }
  }
  modelsLoading.value = true;
  modelsMsg.value = '';
  try {
    const data = await api.post(`/providers/${p.id}/models`, {
      apiKey: apiKey.value,
      baseUrl: baseUrl.value,
    });
    const list = Array.isArray(data.models) ? data.models : [];
    if (data.ok && list.length) {
      setModelOptions(list);
      // Auto-pilih default bila field kosong atau model lama sudah tidak tersedia.
      if (p.id === 'gemini') autoSelect();
      const s = data.summary || {};
      const parts = [`✓ ${s.total || list.length} model ditemukan`];
      if (s.imageGeneration) parts.push(`✓ ${s.imageGeneration} mendukung image generation`);
      if (s.imageEditing) parts.push(`✓ ${s.imageEditing} mendukung image editing`);
      if (s.vision) parts.push(`✓ ${s.vision} vision / image input`);
      // Discovery bisa mengembalikan daftar cadangan bila API rate-limited / offline
      // (bukan kegagalan). Beri tahu user agar tidak salah sangka.
      if (data.rateLimited) parts.push('⚠ model cadangan (API sedang rate-limited)');
      else if (data.source === 'fallback') parts.push('⚠ daftar model cadangan');
      else if (data.message) parts.push(`i ${data.message}`);
      modelsMsg.value = parts.join(' · ');
    } else if (data.ok && !list.length) {
      setModelOptions();
      modelsMsg.value = `✕ Tidak ditemukan model yang kompatibel pada API Key ini.`;
    } else if (!data.ok) {
      setModelOptions();
      modelsMsg.value = `✕ ${data.message || 'Model discovery gagal.'}`;
    } else {
      setModelOptions();
      modelsMsg.value = '✕ Model discovery kosong — pakai daftar bawaan.';
    }
    await fetchProviderStatus();
  } catch (e) {
    modelsMsg.value = `✕ ${e.message}`;
  } finally {
    modelsLoading.value = false;
  }
}

// Auto-pilih model default per kategori: pakai nilai tersimpan bila masih ada,
// selain itu model pertama di kategori tsb (mengikuti capability yang tepat).
function autoSelect() {
  const pick = (field, list) => {
    if (!field.value || !list.some((m) => m.name === field.value)) {
      if (list.length) field.value = list[0].name;
    }
  };
  pick(modelImage, imageModels.value);
  pick(modelEditing, editingModels.value);
  pick(modelText, textModels.value);
}

async function onSelectProvider() {
  // Ganti provider -> set Base URL default, kosongkan pilihan model (tidak di-hardcode).
  const p = activeProvider.value;
  if (p) {
    baseUrl.value = p.defaultBaseUrl;
    apiKey.value = '';
    modelText.value = '';
    modelImage.value = '';
    modelEditing.value = '';
  }
  error.value = '';
  testResult.value = null;
  modelOptions.value = p?.models || [];
  modelsMsg.value = '';
  if (p && p.requiresApiKey) loadModels();
  fetchProviderStatus();
}

onMounted(async () => {
  await auth.fetchMe();
  try {
    const data = await api.get('/providers');
    providers.value = data.providers;
  } catch {
    providers.value = [];
  }
  applyUser();
  if (activeProvider.value && !baseUrl.value) {
    baseUrl.value = activeProvider.value.defaultBaseUrl;
  }
  // Isi dropdown dari model yang sudah tersimpan (hasil discovery sebelumnya),
  // supaya daftar langsung terlihat sebelum "Muat Model" dijalankan.
  try {
    const data = await api.get('/me/models');
    if (Array.isArray(data.models) && data.models.length) setModelOptions(data.models);
  } catch {
    /* ignore */
  }
  try {
    const data = await api.get('/wallet/transactions');
    transactions.value = data.transactions;
  } catch {
    /* ignore */
  }
  await fetchProviderStatus();
  // Auto-load model hanya bila cache sudah kedaluwarsa (point 15). Cache baru
  // (<=10 menit) dipakai tanpa request ulang ke Gemini.
  if (activeProvider.value?.requiresApiKey) loadModels();
});

onBeforeUnmount(() => stopCooldownTimer());

async function saveProvider() {
  saving.value = true;
  saved.value = false;
  error.value = '';
  message.value = '';
  testResult.value = null;
  try {
    // API key hanya dikirim bila diisi (kosong = biarkan key tersimpan tetap).
    const payload = {
      provider: provider.value,
      baseUrl: baseUrl.value,
      modelText: modelText.value,
      modelImage: modelImage.value,
      modelEditing: modelEditing.value,
      enabled: enabled.value,
      useFreeTxt: useFreeTxt.value,
    };
    if (apiKey.value) payload.apiKey = apiKey.value;
    await auth.saveProvider(payload);
    saved.value = true;
    setTimeout(() => (saved.value = false), 2500);
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}

async function testProvider() {
  testing.value = true;
  testResult.value = null;
  try {
    // HANYA request ringan (validasi key + list model). TIDAK mengirim model
    // supaya jelas tidak ada image generation saat test (point 1/9).
    testResult.value = await api.post('/me/provider/test', {
      provider: provider.value,
      apiKey: apiKey.value,
      baseUrl: baseUrl.value,
    });
    await fetchProviderStatus();
  } catch (e) {
    testResult.value = { ok: false, message: e.message };
  } finally {
    testing.value = false;
  }
}

const typeLabel = (t) => ({
  signup_bonus: 'Bonus pendaftaran',
  consume: 'Biaya generate',
  refund: 'Refund',
  grant: 'Top-up admin',
  theme_purchase: 'Beli tema',
}[t] || t);

const typeColor = (t) => (t === 'consume' || t === 'theme_purchase' ? 'text-red-500' : 'text-emerald-600');
</script>

<template>
  <div class="min-h-screen lg:pl-68 pt-16">
    <NavBar />
    <main class="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <h1 class="font-display text-2xl font-extrabold text-slate-900">Pengaturan</h1>

      <!-- Provider AI -->
      <section class="bg-white border border-slate-200 rounded-2xl p-5 md:p-6">
        <div class="flex items-center gap-2 mb-1">
          <span class="w-8 h-8 rounded-lg bg-brand-50 text-brand-500 flex items-center justify-center">
            <AppIcon name="key" :size="17" />
          </span>
          <h2 class="font-bold text-slate-800">AI Providers</h2>
        </div>
        <p class="text-sm text-slate-500 mb-4">
          Pilih provider, lalu isi API key-nya. Setiap provider memakai endpoint, autentikasi, dan format request/response miliknya sendiri — API key tidak akan pernah dikirim ke endpoint provider lain.
        </p>

        <div class="space-y-3">
          <div>
            <label class="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">Nama Provider</label>
            <select
              v-model="provider"
              @change="onSelectProvider"
              class="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400"
            >
              <option v-for="p in providers" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
            <p v-if="activeProvider" class="mt-1.5 text-xs text-slate-400">{{ activeProvider.description }}</p>
          </div>

          <div v-if="activeProvider && activeProvider.requiresApiKey">
            <label class="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">API Key</label>
            <input v-model="apiKey" type="password" autocomplete="off" class="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400" :placeholder="apiKey ? 'Tersimpan (ketik untuk mengganti)' : `sk-... / AIza...`" />
            <p class="mt-1 text-[11px] text-slate-400">Key disimpan terenkripsi di server dan tidak pernah dikembalikan ke browser.</p>
          </div>

          <div class="space-y-3">
            <div class="grid sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">Default Text Model</label>
                <select
                  v-model="modelText"
                  :disabled="!activeProvider"
                  class="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400 disabled:opacity-50"
                >
                  <option value="" disabled>Pilih model...</option>
                  <option v-for="m in textModels" :key="m.name" :value="m.name">{{ m.displayName }}</option>
                </select>
                <p class="mt-1 text-[11px] text-slate-400">Untuk fitur berbasis teks.</p>
              </div>
              <div>
                <label class="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">Base URL / API Endpoint</label>
                <input v-model="baseUrl" type="text" class="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400" :placeholder="activeProvider?.defaultBaseUrl" />
              </div>
            </div>

            <div class="grid sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">Default Image Generation Model</label>
                <select
                  v-model="modelImage"
                  :disabled="!activeProvider"
                  class="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400 disabled:opacity-50"
                >
                  <option value="" disabled>Pilih model...</option>
                  <option v-for="m in imageModels" :key="m.name" :value="m.name">{{ m.displayName }}</option>
                </select>
                <p class="mt-1 text-[11px] text-slate-400">Untuk Text to Image, Poster, Banner.</p>
              </div>
              <div>
                <label class="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">Default Image Editing Model</label>
                <select
                  v-model="modelEditing"
                  :disabled="!activeProvider"
                  class="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400 disabled:opacity-50"
                >
                  <option value="" disabled>Pilih model...</option>
                  <option v-for="m in editingModels" :key="m.name" :value="m.name">{{ m.displayName }}</option>
                </select>
                <p class="mt-1 text-[11px] text-slate-400">Untuk edit foto, ganti background, foto studio.</p>
              </div>
            </div>

            <div class="rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-3">
              <div class="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  @click="loadModels({ force: true })"
                  :disabled="modelsLoading || !activeProvider?.requiresApiKey"
                  title="Sinkronisasi manual daftar model dari API provider"
                  class="shrink-0 px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-500 hover:border-brand-400 hover:text-brand-600 disabled:opacity-40 inline-flex items-center gap-1.5 transition-colors"
                >
                  <span v-if="modelsLoading" class="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></span>
                  <AppIcon v-else name="refresh" :size="15" />
                  <span class="text-xs font-semibold">↻ Refresh Models</span>
                </button>
                <p v-if="modelsMsg" class="text-xs" :class="modelsMsg.startsWith('✓') ? 'text-emerald-600' : 'text-red-600'">{{ modelsMsg }}</p>
              </div>
              <p class="mt-2 text-[11px] text-slate-400">
                Tekan <b>"↻ Refresh Models"</b> untuk mengambil daftar model dari API {{ activeProvider?.name }}. Daftar model otomatis di-cache dan tidak memakai kuota image generation — hanya request daftar model ringan.
              </p>
              <p v-if="unavailableModels.length" class="mt-1 text-[11px] text-amber-600">
                Model terpilih sudah tidak tersedia di daftar provider: <b>{{ unavailableModels.join(', ') }}</b>. Pilih model dari daftar di atas, atau tekan "Refresh Models" untuk memuat ulang.
              </p>
            </div>

            <!-- Dashboard status API key (point 13) -->
            <div class="rounded-xl border px-3.5 py-3" :class="statusInfo.emoji === '🟢' ? 'border-emerald-200 bg-emerald-50/50' : statusInfo.emoji === '🟡' || statusInfo.emoji === '⚠️' ? 'border-amber-200 bg-amber-50/50' : statusInfo.emoji === '🔴' ? 'border-red-200 bg-red-50/50' : 'border-slate-200 bg-slate-50'">
              <div class="flex items-center gap-2">
                <span class="text-base leading-none">{{ statusInfo.emoji }}</span>
                <b class="text-sm" :class="statusInfo.color">{{ statusInfo.label }}</b>
              </div>
              <p class="mt-1 text-xs text-slate-600">{{ statusInfo.detail }}</p>
              <dl class="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-[11px] text-slate-500">
                <div><dt class="uppercase tracking-wide text-slate-400">API Key</dt><dd class="font-mono">{{ providerStatus?.keyMask || '—' }}</dd></div>
                <div><dt class="uppercase tracking-wide text-slate-400">Terakhir Dites</dt><dd>{{ timeAgo(providerStatus?.lastTestedAt) }}</dd></div>
                <div><dt class="uppercase tracking-wide text-slate-400">Terakhir Sukses</dt><dd>{{ timeAgo(providerStatus?.lastSuccessAt) }}</dd></div>
                <div><dt class="uppercase tracking-wide text-slate-400">Error Terakhir</dt><dd>{{ providerStatus?.lastErrorMessage || 'Tidak ada' }}</dd></div>
                <div><dt class="uppercase tracking-wide text-slate-400">Model</dt><dd>{{ providerStatus?.lastModelsSync ? timeAgo(providerStatus.lastModelsSync) : '—' }}</dd></div>
                <div>
                  <dt class="uppercase tracking-wide text-slate-400">Cooldown</dt>
                  <dd v-if="cooldownLeft > 0" class="text-amber-600 font-semibold tabular-nums">{{ cooldownLeft }} dtk</dd>
                  <dd v-else>Tidak ada</dd>
                </div>
              </dl>
              <p v-if="cooldownLeft > 0" class="mt-2 text-xs text-amber-700">
                Gemini sedang terkena rate limit. Coba lagi dalam <b>{{ cooldownLeft }} detik</b>.
              </p>
            </div>
          </div>

          <label class="flex items-center justify-between gap-3 cursor-pointer select-none rounded-xl border border-slate-200 px-3.5 py-2.5">
            <span class="text-sm text-slate-600">
              <b class="text-slate-800">Status: {{ enabled ? 'Aktif' : 'Nonaktif' }}</b>
              <span class="block text-xs text-slate-400">Nonaktif = provider ini tidak dipakai untuk generate.</span>
            </span>
            <button
              type="button"
              role="switch"
              :aria-checked="enabled"
              @click="enabled = !enabled"
              class="relative w-11 h-6 rounded-full transition-colors shrink-0"
              :class="enabled ? 'bg-brand-500' : 'bg-slate-300'"
            >
              <span class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform" :class="enabled ? 'translate-x-5' : ''"></span>
            </button>
          </label>

          <label class="flex items-start gap-2.5 mt-1 cursor-pointer select-none">
            <input v-model="useFreeTxt" type="checkbox" class="mt-0.5 w-4 h-4 rounded accent-brand-500" />
            <span class="text-sm text-slate-600">
              <b class="text-slate-800">Gunakan Pollinations gratis untuk fitur teks</b>
              <span class="block text-xs text-slate-400">
                Text ke Gambar, Poster, Banner &amp; Logo jalan tanpa biaya (tanpa API key). Fitur foto (ubah background, dll.) tetap butuh provider aktif.
              </span>
            </span>
          </label>
          <p v-if="message" class="text-sm text-emerald-600">{{ message }}</p>
          <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
          <div v-if="testResult" class="text-sm rounded-lg px-3 py-2 border break-words" :class="testResult.ok ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-700 bg-red-50 border-red-200'">
            <p><span class="font-bold">{{ testResult.ok ? 'Terhubung' : 'Gagal' }}</span> — {{ testResult.message }}</p>
            <ul v-if="testResult.steps && testResult.steps.length" class="mt-2 space-y-1">
              <li v-for="(s, i) in testResult.steps" :key="i" class="flex items-start gap-1.5">
                <span class="shrink-0" :class="s.ok ? 'text-emerald-600' : 'text-red-600'">{{ s.ok ? '✓' : '✕' }}</span>
                <span><b>{{ s.label }}</b><span v-if="s.detail"> — {{ s.detail }}</span></span>
              </li>
            </ul>
          </div>
          <div class="flex items-center gap-2">
            <button
              @click="saveProvider"
              :disabled="saving"
              class="px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold disabled:opacity-50 inline-flex items-center gap-2 transition-colors"
            >
              <span v-if="saving" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              {{ saved ? 'Tersimpan ✓' : 'Simpan' }}
            </button>
            <button
              @click="testProvider"
              :disabled="testing"
              class="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 hover:border-brand-400 hover:text-brand-600 font-semibold disabled:opacity-50 inline-flex items-center gap-2 transition-colors"
            >
              <span v-if="testing" class="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></span>
              <AppIcon v-else name="zap" :size="15" />
              Test API Key
            </button>
          </div>
          <p class="mt-2 text-[11px] text-slate-400">Test API Key hanya memvalidasi koneksi, key, dan daftar model — <b>tidak membuat gambar</b> sehingga tidak menghabiskan kuota image generation.</p>
        </div>
      </section>

      <!-- Wallet -->
      <section class="bg-white border border-slate-200 rounded-2xl p-5 md:p-6">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <span class="w-8 h-8 rounded-lg bg-brand-50 text-brand-500 flex items-center justify-center">
              <AppIcon name="wallet" :size="17" />
            </span>
            <h2 class="font-bold text-slate-800">Riwayat Kredit</h2>
          </div>
          <span class="text-sm font-bold text-slate-800 tabular-nums">{{ auth.credits.toLocaleString('id-ID') }} kredit</span>
        </div>

        <div v-if="!transactions.length" class="text-sm text-slate-400 py-6 text-center">Belum ada transaksi.</div>
        <ul v-else class="divide-y divide-slate-100">
          <li v-for="tx in transactions" :key="tx.id" class="flex items-center justify-between py-2.5">
            <div>
              <p class="text-sm font-medium text-slate-700">{{ typeLabel(tx.type) }}</p>
              <p class="text-xs text-slate-400">{{ new Date(tx.created_at + ' UTC').toLocaleString('id-ID') }}</p>
            </div>
            <span class="text-sm font-bold tabular-nums" :class="typeColor(tx.type)">
              {{ tx.amount > 0 ? '+' : '' }}{{ tx.amount.toLocaleString('id-ID') }}
            </span>
          </li>
        </ul>

        <p class="mt-4 text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2">
          Untuk pengembang: top-up kredit pengguna bisa dilakukan via API admin
          <code class="text-brand-600 font-mono">POST /api/admin/credits</code> dengan header <code class="text-brand-600 font-mono">x-admin-key</code>.
        </p>
      </section>
    </main>
  </div>
</template>
