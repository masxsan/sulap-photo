<script setup>
import { ref, watch } from 'vue';
import { useThemeStore } from '../stores/theme';
import { useAuthStore } from '../stores/auth';
import { effectFor } from '../themes-ui';
import AppIcon from './AppIcon.vue';

const emit = defineEmits(['close']);
const theme = useThemeStore();
const auth = useAuthStore();

const armed = ref('');
const error = ref('');
const buying = ref('');

watch(armed, () => (error.value = ''));

function select(t) {
  error.value = '';
  if (t.price === 0 || t.owned) {
    theme.setTheme(t.id);
    return;
  }
  if (armed.value === t.id) {
    buy(t);
  } else {
    armed.value = t.id;
  }
}

async function buy(t) {
  if (buying.value) return;
  buying.value = t.id;
  error.value = '';
  try {
    const data = await theme.purchase(t.id);
    if (auth.user && data.user) auth.user = data.user;
    armed.value = '';
  } catch (e) {
    error.value = e.message;
    armed.value = '';
  } finally {
    buying.value = '';
  }
}

function fmt(n) {
  return Number(n).toLocaleString('id-ID');
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" @click.self="emit('close')">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
      <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div>
          <h2 class="font-display font-bold text-lg text-slate-900">Tema</h2>
          <p class="text-xs text-slate-500">Pilih suasana &amp; animasi latar untuk aplikasi.</p>
        </div>
        <button @click="emit('close')" class="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors" title="Tutup">
          <AppIcon name="x" :size="18" />
        </button>
      </div>

      <div class="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <div class="flex items-center gap-2 text-sm text-slate-600">
          <AppIcon name="sparkles" :size="15" class="text-brand-500" />
          <span class="font-medium">Animasi latar</span>
        </div>
        <button
          @click="theme.toggleAnimation()"
          class="relative w-11 h-6 rounded-full transition-colors"
          :class="theme.enableAnimation ? 'bg-brand-500' : 'bg-slate-300'"
          :aria-label="theme.enableAnimation ? 'Matikan animasi' : 'Nyalakan animasi'"
        >
          <span
            class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
            :class="theme.enableAnimation ? 'translate-x-5' : ''"
          ></span>
        </button>
      </div>

      <div v-if="error" class="mx-5 mt-3 px-3 py-2 rounded-lg bg-red-50 text-sm text-red-600">
        {{ error }}
      </div>

      <div class="p-5 overflow-y-auto">
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <button
            v-for="t in theme.themes"
            :key="t.id"
            @click="select(t)"
            class="text-left rounded-xl border transition-all overflow-hidden group"
            :class="[
              theme.id === t.id
                ? 'border-brand-500 ring-2 ring-brand-500/30 shadow-md'
                : 'border-slate-200 hover:border-brand-300 hover:shadow-md',
            ]"
          >
            <div class="h-20 relative flex items-center justify-center" :style="{ background: effectFor(t.id).gradient }">
              <span
                class="w-9 h-9 rounded-full flex items-center justify-center text-white shadow"
                :style="{ background: t.id === 'light' || t.id === 'sakura' || t.id === 'autumn' ? 'rgba(15,23,42,0.35)' : 'rgba(255,255,255,0.18)' }"
              >
                <AppIcon :name="t.icon" :size="18" />
              </span>
              <span
                v-if="theme.id === t.id"
                class="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-brand-500 text-white flex items-center justify-center shadow"
              >
                <AppIcon name="check" :size="12" />
              </span>
              <span
                v-else-if="t.price === 0"
                class="absolute top-1.5 right-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-black/20 text-white"
              >
                Gratis
              </span>
            </div>
            <div class="px-3 py-2">
              <div class="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                <AppIcon :name="t.icon" :size="13" class="text-brand-500" />
                {{ t.name }}
              </div>
              <p class="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-snug">{{ t.description }}</p>
              <div class="mt-1.5">
                <template v-if="t.price === 0 || t.owned">
                  <span class="text-[11px] font-medium text-emerald-600">{{ t.owned ? 'Dimiliki' : 'Gratis' }}</span>
                </template>
                <template v-else>
                  <span
                    class="inline-flex items-center gap-1 text-[11px] font-bold text-brand-600 group-hover:underline"
                    :class="armed === t.id ? 'text-red-600' : ''"
                  >
                    <AppIcon :name="armed === t.id ? 'x' : 'wallet'" :size="11" />
                    {{ armed === t.id ? 'Yakin beli?' : 'Beli · ' + fmt(t.price) }}
                  </span>
                </template>
              </div>
            </div>
          </button>
        </div>

        <p v-if="auth.isLoggedIn" class="mt-4 text-xs text-slate-500">
          Tema berbayar dibeli sekali pakai dengan kredit, lalu dapat dipakai selamanya. Saldo Anda: <b class="text-slate-700">{{ fmt(auth.credits) }}</b> kredit.
        </p>
      </div>
    </div>
  </div>
</template>
