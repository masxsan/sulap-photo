<script setup>
import AppIcon from '../components/AppIcon.vue';

const highlights = [
  { icon: 'sparkles', title: 'Edit Foto dengan AI', desc: 'Ubah background, ekspresi, usia, dan buat gambar dari teks dalam hitungan detik.' },
  { icon: 'wallet', title: 'Sistem Kredit', desc: 'Daftar langsung dapat bonus kredit gratis. Setiap generate hanya butuh beberapa kredit.' },
  { icon: 'key', title: 'BYO API Key', desc: 'Open source — gunakan engine gratis bawaan atau sambungkan API key AI Anda sendiri.' },
];
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-white via-brand-50/30 to-white">
    <div class="max-w-6xl mx-auto px-4">
      <header class="h-14 flex items-center justify-between">
        <div class="flex items-center gap-2 font-display font-bold text-slate-900">
          <span class="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white">
            <AppIcon name="zap" :size="16" />
          </span>
          AuraPhoto
        </div>
        <nav class="flex items-center gap-2">
          <router-link :to="{ name: 'login' }" class="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900">Masuk</router-link>
          <router-link
            :to="{ name: 'register' }"
            class="px-4 py-2 text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 rounded-lg shadow-sm transition-colors"
          >
            Daftar Gratis
          </router-link>
        </nav>
      </header>

      <main class="py-16 md:py-24 text-center">
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-100 text-brand-700 text-xs font-bold uppercase tracking-wide">
          <AppIcon name="sparkles" :size="14" /> Open Source AI Photo
        </span>
        <h1 class="mt-5 font-display text-4xl md:text-6xl font-extrabold text-slate-900 leading-tight">
          Edit Foto Biasa<br />
          Jadi <span class="text-transparent bg-clip-text bg-gradient-to-r from-brand-500 to-pink-500">Karya Menakjubkan</span>
        </h1>
        <p class="mt-5 max-w-xl mx-auto text-slate-600 text-lg">
          Uplop, tulis, dan biarkan AI mengerjakannya. Gratis untuk memulai — tanpa kartu kredit.
        </p>
        <div class="mt-8 flex items-center justify-center gap-3">
          <router-link
            :to="{ name: 'register' }"
            class="px-6 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold shadow-lg shadow-brand-500/25 transition-all hover:-translate-y-0.5"
          >
            Mulai Gratis
          </router-link>
          <router-link
            :to="{ name: 'login' }"
            class="px-6 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold hover:border-brand-300 transition-colors"
          >
            Sudah punya akun
          </router-link>
        </div>
      </main>

      <section class="grid md:grid-cols-3 gap-4 pb-20">
        <div v-for="h in highlights" :key="h.title" class="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-lg hover:border-brand-200 transition-all">
          <span class="w-11 h-11 rounded-xl bg-brand-50 text-brand-500 flex items-center justify-center mb-4">
            <AppIcon :name="h.icon" :size="22" />
          </span>
          <h3 class="font-bold text-slate-900 mb-1">{{ h.title }}</h3>
          <p class="text-sm text-slate-500">{{ h.desc }}</p>
        </div>
      </section>
    </div>
  </div>
</template>
