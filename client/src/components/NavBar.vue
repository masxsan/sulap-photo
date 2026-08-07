<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useThemeStore } from '../stores/theme';
import AppIcon from './AppIcon.vue';
import ThemePicker from './ThemePicker.vue';

const auth = useAuthStore();
const theme = useThemeStore();
const router = useRouter();

const pickerOpen = ref(false);

onMounted(() => {
  theme.fetchThemes();
});

function logout() {
  auth.logout();
  router.push({ name: 'login' });
}
</script>

<template>
  <header class="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-200">
    <div class="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
      <router-link :to="{ name: 'dashboard' }" class="flex items-center gap-2 font-display font-bold text-slate-900">
        <span class="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white">
          <AppIcon name="zap" :size="16" />
        </span>
        AuraPhoto
      </router-link>

      <nav class="flex items-center gap-1 sm:gap-2">
        <router-link
          v-for="item in [
            { name: 'dashboard', label: 'Beranda', icon: 'sparkles' },
            { name: 'history', label: 'Riwayat', icon: 'clock' },
            { name: 'settings', label: 'Pengaturan', icon: 'settings' },
          ]"
          :key="item.name"
          :to="{ name: item.name }"
          class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:text-brand-600 hover:bg-brand-50 transition-colors"
          active-class="text-brand-600 bg-brand-50"
        >
          <AppIcon :name="item.icon" :size="16" />
          <span class="hidden sm:inline">{{ item.label }}</span>
        </router-link>

        <div class="flex items-center gap-2 ml-1 pl-3 border-l border-slate-200">
          <button
            @click="pickerOpen = true"
            title="Ganti tema"
            class="p-2 rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 transition-colors"
          >
            <AppIcon name="palette" :size="16" />
          </button>
          <span class="inline-flex items-center gap-1 text-sm font-semibold text-slate-700">
            <AppIcon name="wallet" :size="15" class="text-brand-500" />
            {{ auth.credits.toLocaleString('id-ID') }}
          </span>
          <button
            @click="logout"
            title="Keluar"
            class="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <AppIcon name="logout" :size="16" />
          </button>
        </div>
      </nav>
    </div>
  </header>

  <ThemePicker v-if="pickerOpen" @close="pickerOpen = false" />
</template>
