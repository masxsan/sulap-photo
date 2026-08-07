<script setup>
import { computed } from 'vue';
import AppIcon from './AppIcon.vue';
import ImageUploader from './ImageUploader.vue';

const props = defineProps({
  schema: { type: Array, default: () => [] },
  modelValue: { type: Object, default: () => ({}) },
});
const emit = defineEmits(['update:modelValue']);

function set(id, value) {
  emit('update:modelValue', { ...props.modelValue, [id]: value });
}

function current(id) {
  const v = props.modelValue[id];
  if (v === undefined || v === null || v === '') return undefined;
  return v;
}
</script>

<template>
  <div class="space-y-4">
    <template v-for="field in schema" :key="field.id">
      <!-- Text pendek -->
      <div v-if="field.type === 'TEXT'">
        <label class="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">
          {{ field.label }} <span v-if="field.required" class="text-brand-500">*</span>
        </label>
        <input
          type="text"
          :value="current(field.id) ?? ''"
          @input="set(field.id, $event.target.value)"
          :placeholder="field.placeholder"
          class="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400"
        />
      </div>

      <!-- Textarea -->
      <div v-else-if="field.type === 'TEXTAREA'">
        <label class="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">
          {{ field.label }} <span v-if="field.required" class="text-brand-500">*</span>
        </label>
        <textarea
          :value="current(field.id) ?? ''"
          @input="set(field.id, $event.target.value)"
          :placeholder="field.placeholder"
          :rows="field.rows || 3"
          class="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400"
        ></textarea>
      </div>

      <!-- Upload gambar -->
      <ImageUploader
        v-else-if="field.type === 'IMAGE_UPLOAD'"
        :model-value="current(field.id)"
        @update:model-value="(v) => set(field.id, v)"
        :label="field.label"
      />

      <!-- Segmented control (pilihan pill) -->
      <div v-else-if="field.type === 'SEGMENTED_CONTROL'">
        <label class="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">{{ field.label }}</label>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="opt in field.options"
            :key="opt.value"
            type="button"
            @click="set(field.id, opt.value)"
            :class="[
              'px-3.5 py-1.5 rounded-full text-sm font-medium transition-all',
              (current(field.id) ?? field.defaultValue) === opt.value
                ? 'bg-brand-500 text-white shadow-sm'
                : 'bg-white border border-slate-300 text-slate-600 hover:border-brand-400',
            ]"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
