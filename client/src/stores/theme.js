import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { api } from '../api';

const LS_THEME = 'sulap.theme.id';
const LS_ANIM = 'sulap.theme.anim';

export const useThemeStore = defineStore('theme', () => {
  const id = ref(localStorage.getItem(LS_THEME) || 'light');
  const enableAnimation = ref(localStorage.getItem(LS_ANIM) !== '0');
  const themes = ref([]);
  const busy = ref(false);

  const ownedIds = computed(() => new Set(themes.value.filter((t) => t.owned).map((t) => t.id)));
  const current = computed(() => themes.value.find((t) => t.id === id.value));

  function persist() {
    localStorage.setItem(LS_THEME, id.value);
    localStorage.setItem(LS_ANIM, enableAnimation.value ? '1' : '0');
    document.documentElement.setAttribute('data-theme', id.value);
    document.documentElement.setAttribute('data-anim', enableAnimation.value ? '1' : '0');
  }

  function applyTheme() {
    // Tema berbayar yang belum dibeli -> fallback ke light
    if (themes.value.length && current.value && current.value.price > 0 && !current.value.owned) {
      id.value = 'light';
    }
    persist();
  }

  async function fetchThemes() {
    try {
      const data = await api.get('/themes');
      themes.value = data.themes;
      applyTheme();
    } catch {
      /* offline: biarkan tema lokal */
    }
  }

  function setTheme(nextId) {
    const t = themes.value.find((x) => x.id === nextId);
    if (!t) return;
    if (t.price > 0 && !t.owned) return;
    id.value = nextId;
    persist();
  }

  function toggleAnimation() {
    enableAnimation.value = !enableAnimation.value;
    persist();
  }

  async function purchase(themeId) {
    busy.value = true;
    try {
      const data = await api.post(`/themes/${themeId}/purchase`);
      themes.value = data.themes;
      id.value = themeId;
      persist();
      return data;
    } finally {
      busy.value = false;
    }
  }

  applyTheme();

  return { id, enableAnimation, themes, ownedIds, current, busy, fetchThemes, setTheme, toggleAnimation, purchase };
});
