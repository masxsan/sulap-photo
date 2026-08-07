<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api';
import { useCatalogStore } from '../stores/catalog';
import NavBar from '../components/NavBar.vue';
import AppIcon from '../components/AppIcon.vue';

const router = useRouter();
const catalog = useCatalogStore();
const items = ref([]);
const loading = ref(true);

onMounted(async () => {
  try {
    await catalog.fetch();
    const data = await api.get('/history');
    items.value = data.items;
  } finally {
    loading.value = false;
  }
});

const statusBadge = (s) => ({
  done: 'bg-emerald-50 text-emerald-600',
  running: 'bg-brand-50 text-brand-600',
  error: 'bg-red-50 text-red-600',
}[s] || 'bg-slate-100 text-slate-500');

const statusLabel = (s) => (s === 'done' ? 'Selesai' : s === 'running' ? 'Proses' : 'Gagal');
</script>

<template>
  <div class="min-h-screen">
    <NavBar />
    <main class="max-w-4xl mx-auto px-4 py-8">
      <h1 class="font-display text-2xl font-extrabold text-slate-900 mb-6">Riwayat</h1>

      <div v-if="loading" class="flex items-center justify-center py-20 text-slate-400">
        <span class="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mr-2"></span>
        Memuat...
      </div>

      <div v-else-if="!items.length" class="bg-white border border-slate-200 rounded-2xl p-12 text-center">
        <span class="inline-flex w-12 h-12 rounded-full bg-slate-100 items-center justify-center text-slate-300 mb-3">
          <AppIcon name="clock" :size="24" />
        </span>
        <p class="text-slate-500">Belum ada riwayat. Mulai generate pertamamu!</p>
      </div>

      <div v-else class="space-y-2.5">
        <button
          v-for="item in items"
          :key="item.batchId"
          @click="router.push({ name: 'feature', params: { id: item.featureId }, query: { batch: item.batchId } })"
          class="w-full flex items-center gap-4 bg-white border border-slate-200 rounded-xl px-4 py-3.5 hover:border-brand-300 hover:shadow-sm transition-all text-left"
        >
          <span class="w-10 h-10 rounded-lg bg-brand-50 text-brand-500 flex items-center justify-center shrink-0">
            <AppIcon :name="catalog.getFeature(item.featureId)?.icon || 'image'" :size="19" />
          </span>
          <span class="flex-1 min-w-0">
            <span class="block font-semibold text-slate-800 truncate">{{ catalog.getFeature(item.featureId)?.name || item.featureId }}</span>
            <span class="block text-xs text-slate-400">{{ new Date(item.createdAt + ' UTC').toLocaleString('id-ID') }}</span>
          </span>
          <span class="text-xs text-slate-400 tabular-nums">{{ item.done }}/{{ item.total }}</span>
          <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold" :class="statusBadge(item.status)">{{ statusLabel(item.status) }}</span>
        </button>
      </div>
    </main>
  </div>
</template>
