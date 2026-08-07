<script setup>
import AppIcon from './AppIcon.vue';
import ResultImage from './ResultImage.vue';
import { api } from '../api';

const props = defineProps({
  jobs: { type: Array, default: () => [] },
  featureName: { type: String, default: '' },
});

const allDone = () => props.jobs.length > 0 && props.jobs.every((j) => j.status === 'done');
const doneJobs = () => props.jobs.filter((j) => j.status === 'done');

async function downloadJob(job) {
  try {
    const url = await api.fileUrl(job.resultUrl);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aura-${props.featureName.replace(/\s+/g, '-').toLowerCase()}-${job.id}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch {
    /* ignore */
  }
}

async function downloadAll() {
  for (const job of doneJobs()) await downloadJob(job);
}
</script>

<template>
  <div>
    <!-- Loading -->
    <div v-if="!allDone()" class="space-y-3">
      <div
        v-for="job in jobs"
        :key="job.id"
        class="relative rounded-xl border border-slate-200 bg-slate-100 overflow-hidden"
        :style="{ aspectRatio: '1 / 1' }"
      >
        <div v-if="job.status === 'queued' || job.status === 'running'" class="absolute inset-0 flex flex-col items-center justify-center text-center gap-2">
          <span class="w-10 h-10 rounded-full border-4 border-brand-500 border-t-transparent animate-spin"></span>
          <p class="text-sm text-slate-500">{{ job.status === 'running' ? 'AI sedang bekerja...' : 'Menunggu antrean...' }}</p>
        </div>
        <div v-else-if="job.status === 'error'" class="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
          <AppIcon name="x" :size="24" class="text-red-400 mb-1" />
          <p class="text-xs text-red-500 font-medium">{{ job.error }}</p>
        </div>
      </div>
      <p v-if="!jobs.length" class="text-sm text-slate-400 text-center py-8">Memulai...</p>
    </div>

    <!-- Results -->
    <div v-else class="space-y-4">
      <div v-if="jobs.length > 1" class="flex justify-end">
        <button
          @click="downloadAll"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand-600 bg-brand-50 hover:bg-brand-100 rounded-lg transition-colors"
        >
          <AppIcon name="download" :size="14" /> Download Semua ({{ doneJobs().length }})
        </button>
      </div>
      <div :class="['grid gap-3', jobs.length > 1 ? 'grid-cols-2' : 'grid-cols-1']">
        <div v-for="job in jobs" :key="job.id" class="group relative rounded-xl border border-slate-200 overflow-hidden bg-slate-100">
          <div class="aspect-square w-full">
            <ResultImage v-if="job.status === 'done'" :path="job.resultUrl" />
          </div>
          <div class="absolute bottom-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              @click="downloadJob(job)"
              title="Download"
              class="w-8 h-8 rounded-full bg-slate-900/80 text-brand-400 flex items-center justify-center hover:bg-slate-900 transition-colors"
            >
              <AppIcon name="download" :size="15" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
