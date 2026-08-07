<script setup>
import { onMounted } from 'vue';
import { useAuthStore } from './stores/auth';
import { useThemeStore } from './stores/theme';
import ThemeEffects from './components/ThemeEffects.vue';

const auth = useAuthStore();
const theme = useThemeStore();

onMounted(() => {
  auth.fetchMe();
  theme.fetchThemes();
});
</script>

<template>
  <ThemeEffects />
  <div class="relative z-10 min-h-screen">
    <router-view />
  </div>
</template>
