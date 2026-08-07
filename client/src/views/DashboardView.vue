<script setup>
import { onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useCatalogStore } from '../stores/catalog';
import NavBar from '../components/NavBar.vue';
import AppIcon from '../components/AppIcon.vue';

const auth = useAuthStore();
const catalog = useCatalogStore();

onMounted(async () => {
  catalog.fetch();
  auth.fetchMe();
});

const firstName = () => (auth.user?.name || 'Pengguna').split(' ')[0];
</script>

<template>
  <div class="min-h-screen lg:pl-68 pt-16">
    <NavBar />
    <main class="max-w-6xl mx-auto px-4 py-8">
      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-8">
        <div>
          <h1 class="font-display text-2xl md:text-3xl font-extrabold text-slate-900">Hai, {{ firstName() }} 👋</h1>
          <p class="text-slate-500 mt-1">Pilih fitur AI dan mulai berkreasi.</p>
        </div>
        <div class="inline-flex items-center gap-3 px-4 py-2.5 bg-white border border-slate-200 rounded-xl shadow-sm">
          <span class="w-9 h-9 rounded-lg bg-brand-50 text-brand-500 flex items-center justify-center">
            <AppIcon name="wallet" :size="18" />
          </span>
          <div>
            <p class="text-[10px] font-bold uppercase tracking-widest text-slate-400">Saldo Kredit</p>
            <p class="text-lg font-bold text-slate-900 leading-none tabular-nums">{{ auth.credits.toLocaleString('id-ID') }}</p>
          </div>
        </div>
      </div>

      <div
        v-if="!auth.providerConfigured"
        class="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
      >
        <p class="text-sm text-amber-800">
          <strong>Mode gratis aktif.</strong> Fitur berbasis foto (ubah background, ekspresi, dll.) butuh API key AI.
          Tambahkan di <router-link :to="{ name: 'settings' }" class="font-semibold underline">Pengaturan</router-link>.
        </p>
      </div>

      <div v-if="!catalog.features.length" class="flex items-center justify-center py-20 text-slate-400">
        <span class="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mr-2"></span>
        Memuat fitur...
      </div>

      <div v-for="cat in catalog.byCategory" :key="cat.id" class="mb-10">
        <div class="flex items-center gap-2 mb-4">
          <span class="w-1.5 h-5 rounded-full" :style="{ background: cat.color }"></span>
          <h2 class="font-bold text-slate-800">{{ cat.name }}</h2>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <router-link
            v-for="f in cat.features"
            :key="f.id"
            :to="{ name: 'feature', params: { id: f.id } }"
            class="group bg-white border border-slate-200 rounded-2xl p-4 hover:shadow-md hover:border-brand-200 hover:-translate-y-0.5 transition-all"
          >
            <span class="w-10 h-10 rounded-xl bg-brand-50 text-brand-500 flex items-center justify-center mb-3 group-hover:bg-brand-500 group-hover:text-white transition-colors">
              <AppIcon :name="f.icon" :size="20" />
            </span>
            <h3 class="font-semibold text-slate-800 text-sm leading-tight">{{ f.name }}</h3>
            <p class="text-xs text-slate-400 mt-1">{{ f.creditCost }} kredit</p>
          </router-link>
        </div>
      </div>
    </main>
  </div>
</template>
