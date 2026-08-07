<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api';
import { useCatalogStore } from '../stores/catalog';
import { useAuthStore } from '../stores/auth';
import NavBar from '../components/NavBar.vue';
import AppIcon from '../components/AppIcon.vue';
import FeatureForm from '../components/FeatureForm.vue';
import ResultPanel from '../components/ResultPanel.vue';

const route = useRoute();
const router = useRouter();
const catalog = useCatalogStore();
const auth = useAuthStore();

const feature = computed(() => catalog.getFeature(route.params.id));
const formValues = ref({});
const ratio = ref('1:1');
const count = ref(1);

const generating = ref(false);
const batch = ref(null);
const error = ref('');
const successMessage = ref('');

const ratios = [
  { value: '1:1', label: 'Persegi 1:1' },
  { value: '16:9', label: 'Lansekap 16:9' },
  { value: '9:16', label: 'Potret 9:16' },
  { value: '4:3', label: '4:3' },
  { value: '3:4', label: '3:4' },
];

const totalCost = computed(() => (feature.value?.creditCost || 0) * count.value);
const canGenerate = computed(() => !generating.value && !error.value);

let pollTimer = null;

onMounted(async () => {
  await catalog.fetch();
  if (!feature.value) {
    router.push({ name: 'dashboard' });
    return;
  }
  // inisialisasi defaultValue dari uiSchema
  const init = {};
  for (const f of feature.value.uiSchema || []) {
    if (f.defaultValue !== undefined) init[f.id] = f.defaultValue;
  }
  formValues.value = init;
  auth.fetchMe();
});

onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer);
});

function validate() {
  for (const f of feature.value.uiSchema || []) {
    const v = formValues.value[f.id];
    if (f.required && (v === undefined || v === null || v === '')) {
      return `Field "${f.label}" wajib diisi`;
    }
  }
  return '';
}

async function generate() {
  error.value = '';
  successMessage.value = '';
  const v = validate();
  if (v) {
    error.value = v;
    return;
  }
  if (auth.credits < totalCost.value) {
    error.value = `Kredit tidak cukup. Butuh ${totalCost.value}, saldo ${auth.credits}.`;
    return;
  }

  generating.value = true;
  batch.value = null;

  const images = (feature.value.uiSchema || [])
    .filter((f) => f.type === 'IMAGE_UPLOAD')
    .map((f) => formValues.value[f.id])
    .filter(Boolean);

  try {
    const res = await api.post('/generate', {
      featureId: feature.value.id,
      formValues: formValues.value,
      images,
      ratio: ratio.value,
      count: String(count.value),
    });
    batch.value = { batchId: res.batchId, jobs: res.jobs.map((id) => ({ id, status: 'queued' })) };
    poll();
  } catch (e) {
    error.value = e.message;
    generating.value = false;
  }
}

async function poll() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    if (!batch.value) return;
    try {
      const data = await api.get(`/jobs/${batch.value.batchId}`);
      batch.value = data;
      if (data.status !== 'running') {
        clearInterval(pollTimer);
        pollTimer = null;
        generating.value = false;
        auth.fetchMe();
        if (data.status === 'error') {
          const failed = data.jobs.filter((j) => j.status === 'error');
          error.value = failed[0]?.error || 'Terjadi kesalahan saat memproses.';
        }
      }
    } catch {
      clearInterval(pollTimer);
      pollTimer = null;
      generating.value = false;
    }
  }, 4000);
}
</script>

<template>
  <div class="min-h-screen">
    <NavBar />
    <main class="max-w-6xl mx-auto px-4 py-8">
      <button
        @click="router.push({ name: 'dashboard' })"
        class="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors mb-5"
      >
        <AppIcon name="arrowLeft" :size="16" /> Kembali
      </button>

      <template v-if="feature">
        <div class="flex items-center gap-3 mb-6">
          <span class="w-11 h-11 rounded-xl bg-brand-500 text-white flex items-center justify-center">
            <AppIcon :name="feature.icon" :size="22" />
          </span>
          <div>
            <h1 class="font-display text-xl md:text-2xl font-extrabold text-slate-900">{{ feature.name }}</h1>
            <p class="text-sm text-slate-500">{{ feature.description }}</p>
          </div>
          <span class="ml-auto inline-flex items-center gap-1 px-3 py-1 rounded-full bg-brand-50 text-brand-600 text-xs font-bold">
            {{ feature.creditCost }} kredit / gambar
          </span>
        </div>

        <div class="grid lg:grid-cols-2 gap-6">
          <!-- Form -->
          <div class="bg-white border border-slate-200 rounded-2xl p-5 md:p-6">
            <h2 class="font-bold text-slate-800 mb-4">Pengaturan</h2>
            <FeatureForm :schema="feature.uiSchema" v-model="formValues" />

            <div class="grid grid-cols-2 gap-4 mt-5">
              <div>
                <label class="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">Rasio</label>
                <select v-model="ratio" class="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400">
                  <option v-for="r in ratios" :key="r.value" :value="r.value">{{ r.label }}</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">Jumlah (1-4)</label>
                <select v-model="count" class="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400">
                  <option v-for="n in 4" :key="n" :value="n">{{ n }} gambar</option>
                </select>
              </div>
            </div>

            <p v-if="error" class="mt-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{{ error }}</p>
            <p v-if="successMessage" class="mt-4 text-sm text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">{{ successMessage }}</p>

            <button
              @click="generate"
              :disabled="generating"
              class="mt-5 w-full py-3.5 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 text-white font-bold shadow-lg shadow-brand-500/25 hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span v-if="generating" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              <AppIcon v-else name="sparkles" :size="18" />
              {{ generating ? 'Memproses...' : `Generate (${totalCost} kredit)` }}
            </button>
          </div>

          <!-- Hasil -->
          <div class="bg-white border border-slate-200 rounded-2xl p-5 md:p-6">
            <h2 class="font-bold text-slate-800 mb-4">Hasil</h2>
            <div v-if="!batch" class="h-64 flex flex-col items-center justify-center text-center">
              <span class="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-300 mb-3">
                <AppIcon name="image" :size="24" />
              </span>
              <p class="text-sm text-slate-400">Atur pengaturan lalu klik Generate.</p>
            </div>
            <ResultPanel v-else :jobs="batch.jobs" :feature-name="feature.name" />
          </div>
        </div>
      </template>
    </main>
  </div>
</template>
