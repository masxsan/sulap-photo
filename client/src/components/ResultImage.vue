<script setup>
import { ref, watch, onBeforeUnmount } from 'vue';
import { api } from '../api';

const props = defineProps({ path: { type: String, default: '' } });

const url = ref(null);
let current = '';

async function load() {
  if (!props.path || props.path === current) return;
  current = props.path;
  url.value = null;
  try {
    url.value = await api.fileUrl(props.path);
  } catch {
    url.value = null;
  }
}

watch(() => props.path, load, { immediate: true });
onBeforeUnmount(() => {
  if (url.value) URL.revokeObjectURL(url.value);
});
</script>

<template>
  <img v-if="url" :src="url" class="w-full h-full object-contain" alt="Hasil" />
  <div v-else class="w-full h-full flex items-center justify-center text-slate-300">
    <svg class="w-8 h-8 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-linecap="round" /></svg>
  </div>
</template>
