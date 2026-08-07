<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useThemeStore } from '../stores/theme';
import { useCatalogStore } from '../stores/catalog';
import AppIcon from './AppIcon.vue';
import ThemePicker from './ThemePicker.vue';

const auth = useAuthStore();
const theme = useThemeStore();
const catalog = useCatalogStore();
const route = useRoute();
const router = useRouter();

const pickerOpen = ref(false);
const sidebarOpen = ref(false);
const openCats = ref({});

const mainMenu = [
  { name: 'dashboard', label: 'Beranda', icon: 'home' },
  { name: 'history', label: 'Riwayat', icon: 'clock' },
  { name: 'settings', label: 'Pengaturan', icon: 'settings' },
];

const categories = computed(() => catalog.byCategory);

const initials = computed(() => (auth.user?.name || 'Pengguna').trim().charAt(0).toUpperCase() || 'P');
const firstName = computed(() => (auth.user?.name || 'Pengguna').split(' ')[0]);

function isActive(item) {
  return route.name === item.name;
}

function isFeatureActive(id) {
  return route.name === 'feature' && route.params.id === id;
}

function toggleCat(id) {
  openCats.value[id] = !openCats.value[id];
}

function isCatOpen(id) {
  return !!openCats.value[id];
}

function openCatForRoute() {
  if (route.name === 'feature') {
    const f = catalog.getFeature(route.params.id);
    if (f) openCats.value[f.category] = true;
  }
}

onMounted(() => {
  theme.fetchThemes();
  catalog.fetch().then(openCatForRoute);
  openCatForRoute();
});

watch(
  () => route.fullPath,
  () => {
    sidebarOpen.value = false;
    openCatForRoute();
  }
);

function logout() {
  auth.logout();
  router.push({ name: 'login' });
}
</script>

<template>
  <!-- Backdrop (mobile) -->
  <transition name="sp-fade">
    <div
      v-if="sidebarOpen"
      class="fixed inset-0 z-40 bg-navy-950/60 backdrop-blur-sm lg:hidden"
      @click="sidebarOpen = false"
    ></div>
  </transition>

  <!-- Sidebar -->
  <aside
    class="fixed inset-y-0 left-0 z-50 w-68 flex flex-col bg-gradient-to-b from-navy-800 via-navy-900 to-navy-950 text-white shadow-2xl shadow-navy-950/40 transition-transform duration-300 ease-in-out -translate-x-full lg:translate-x-0"
    :class="sidebarOpen ? 'translate-x-0' : ''"
    aria-label="Navigasi utama"
  >
    <!-- Brand -->
    <div class="flex items-center gap-2.5 px-5 h-16 shrink-0 border-b border-white/10">
      <span class="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30">
        <AppIcon name="zap" :size="18" />
      </span>
      <div class="leading-tight">
        <p class="font-display font-bold text-lg">AuraPhoto</p>
        <p class="text-[11px] text-slate-400">AI Photo Studio</p>
      </div>
    </div>

    <!-- Menu (scrollable) -->
    <nav class="sidebar-scroll flex-1 overflow-y-auto px-3 py-4">
      <!-- Menu utama -->
      <p class="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Menu Utama</p>
      <div class="space-y-1 mb-6">
        <router-link
          v-for="item in mainMenu"
          :key="item.name"
          :to="{ name: item.name }"
          class="relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group"
          :class="isActive(item)
            ? 'bg-emerald-500/20 text-white font-semibold'
            : 'text-slate-300 hover:bg-white/10 hover:text-white'"
        >
          <span
            v-if="isActive(item)"
            class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-emerald-400"
          ></span>
          <AppIcon :name="item.icon" :size="18" class="shrink-0" />
          <span>{{ item.label }}</span>
        </router-link>
      </div>

      <!-- Kategori fitur AI (submenu) -->
      <template v-if="categories.length">
        <p class="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Fitur AI</p>
        <div class="space-y-1">
          <div v-for="cat in categories" :key="cat.id" class="mb-1">
            <button
              @click="toggleCat(cat.id)"
              class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-all duration-200"
            >
              <span
                class="w-2 h-2 rounded-full shrink-0"
                :style="{ backgroundColor: cat.color }"
              ></span>
              <span class="flex-1 text-left">{{ cat.name }}</span>
              <AppIcon
                name="chevronDown"
                :size="15"
                class="shrink-0 transition-transform duration-300"
                :class="isCatOpen(cat.id) ? 'rotate-180' : ''"
              />
            </button>

            <transition name="sp-dropdown">
              <div v-if="isCatOpen(cat.id)">
                <div class="ml-4 mt-1 pl-3 border-l border-white/10 space-y-0.5">
                  <router-link
                    v-for="f in cat.features"
                    :key="f.id"
                    :to="{ name: 'feature', params: { id: f.id } }"
                    class="relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200"
                    :class="isFeatureActive(f.id)
                      ? 'bg-emerald-500/20 text-white'
                      : 'text-slate-400 hover:bg-white/10 hover:text-white'"
                  >
                    <AppIcon :name="f.icon" :size="15" class="shrink-0 opacity-70" />
                    <span class="truncate">{{ f.name }}</span>
                  </router-link>
                </div>
              </div>
            </transition>
          </div>
        </div>
      </template>
    </nav>

    <!-- Profil + kredit -->
    <div class="shrink-0 p-3 border-t border-white/10 bg-navy-900/60">
      <div class="flex items-center gap-3 px-2 py-2 rounded-xl bg-white/5">
        <span class="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-sm shrink-0">
          {{ initials }}
        </span>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold truncate">{{ firstName() }}</p>
          <p class="text-xs text-emerald-300 font-medium">
            <AppIcon name="wallet" :size="12" class="inline -mt-0.5" />
            {{ auth.credits.toLocaleString('id-ID') }} kredit
          </p>
        </div>
        <button
          @click="logout"
          title="Keluar"
          class="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <AppIcon name="logout" :size="16" />
        </button>
      </div>
    </div>
  </aside>

  <!-- Header -->
  <header class="fixed top-0 right-0 z-30 h-16 left-0 lg:left-68 bg-white/90 backdrop-blur border-b border-slate-200">
    <div class="h-full flex items-center gap-3 px-4 lg:px-6">
      <button
        @click="sidebarOpen = true"
        title="Buka menu"
        class="lg:hidden -ml-1 p-2 rounded-lg text-slate-600 hover:text-brand-600 hover:bg-brand-50 transition-colors"
      >
        <AppIcon name="menu" :size="22" />
      </button>

      <router-link :to="{ name: 'dashboard' }" class="flex items-center gap-2 font-display font-bold text-slate-900">
        <span class="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white">
          <AppIcon name="zap" :size="15" />
        </span>
        <span class="text-[15px]">AuraPhoto</span>
      </router-link>

      <div class="ml-auto flex items-center gap-2">
        <span
          class="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700"
          title="Saldo kredit"
        >
          <AppIcon name="wallet" :size="16" class="text-brand-500" />
          <span class="tabular-nums">{{ auth.credits.toLocaleString('id-ID') }}</span>
        </span>

        <button
          @click="pickerOpen = true"
          title="Ganti tema"
          class="p-2 rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 transition-colors"
        >
          <AppIcon name="palette" :size="18" />
        </button>

        <span
          class="hidden sm:inline-flex w-8 h-8 rounded-full bg-brand-50 text-brand-600 items-center justify-center font-bold text-sm"
          :title="auth.user?.name || 'Pengguna'"
        >
          {{ initials }}
        </span>
      </div>
    </div>
  </header>

  <ThemePicker v-if="pickerOpen" @close="pickerOpen = false" />
</template>

<style scoped>
.sp-dropdown-enter-active,
.sp-dropdown-leave-active {
  transition: opacity 0.25s ease, max-height 0.25s ease, transform 0.25s ease;
  overflow: hidden;
}
.sp-dropdown-enter-from,
.sp-dropdown-leave-to {
  opacity: 0;
  max-height: 0;
  transform: translateY(-4px);
}
.sp-dropdown-enter-to,
.sp-dropdown-leave-from {
  opacity: 1;
  max-height: 300px;
  transform: translateY(0);
}
</style>
