<script setup>
import { ref, watch, onBeforeUnmount } from 'vue';
import { api } from '../api';
import AppIcon from './AppIcon.vue';

const props = defineProps({
  modelValue: { type: [String, Number, null], default: null },
  label: { type: String, default: '' },
  accept: { type: String, default: 'image/*' },
  maxMb: { type: Number, default: 10 },
});
const emit = defineEmits(['update:modelValue']);

const previewUrl = ref(null);
const error = ref('');
const uploading = ref(false);
const inputRef = ref(null);

function revoke() {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
    previewUrl.value = null;
  }
}

async function loadPreview(id) {
  if (!id) return;
  try {
    previewUrl.value = await api.fileUrl(`/uploads/${id}/file`);
  } catch {
    previewUrl.value = null;
  }
}

async function handleFile(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    error.value = 'Hanya file gambar yang diizinkan';
    return;
  }
  if (file.size > props.maxMb * 1024 * 1024) {
    error.value = `File terlalu besar. Maksimal ${props.maxMb}MB`;
    return;
  }
  error.value = '';
  uploading.value = true;
  try {
    const { id } = await api.upload('/uploads', file);
    revoke();
    emit('update:modelValue', id);
    await loadPreview(id);
  } catch (e) {
    error.value = e.message;
  } finally {
    uploading.value = false;
  }
}

function onDrop(e) {
  const f = e.dataTransfer?.files?.[0];
  if (f) handleFile(f);
}

function remove() {
  revoke();
  emit('update:modelValue', null);
}

watch(() => props.modelValue, (v) => {
  if (v) {
    error.value = '';
    loadPreview(v);
  } else {
    revoke();
  }
});

onBeforeUnmount(revoke);
</script>

<template>
  <div>
    <label v-if="label" class="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">{{ label }}</label>
    <div
      v-if="modelValue"
      class="relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-100"
    >
      <img v-if="previewUrl" :src="previewUrl" class="w-full h-full object-contain" alt="Pratinjau" />
      <div v-else class="w-full h-full flex items-center justify-center text-slate-300">
        <svg class="w-8 h-8 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-linecap="round" /></svg>
      </div>
      <button
        type="button"
        @click="remove"
        class="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black transition-colors"
      >
        <AppIcon name="x" :size="14" />
      </button>
    </div>
    <div
      v-else
      @click="inputRef?.click()"
      @dragover.prevent
      @drop.prevent="onDrop"
      class="ui-upload-box flex flex-col items-center justify-center gap-1.5 h-44 border-2 border-dashed border-slate-300 hover:border-brand-400 hover:bg-brand-50/40 rounded-xl cursor-pointer transition-colors text-center"
    >
      <span class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
        <AppIcon :name="uploading ? 'loader' : 'upload'" :size="20" :class="{ 'animate-spin': uploading }" />
      </span>
      <p class="text-sm font-medium text-slate-500">Klik atau tarik foto ke sini</p>
      <p class="text-xs text-slate-400">JPG, PNG, WebP — maks {{ maxMb }}MB</p>
    </div>
    <input ref="inputRef" type="file" :accept="accept" class="hidden" @change="(e) => handleFile(e.target.files?.[0])" />
    <p v-if="error" class="text-xs text-red-500 mt-1">{{ error }}</p>
  </div>
</template>
