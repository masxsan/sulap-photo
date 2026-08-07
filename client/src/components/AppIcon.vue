<script setup>
const props = defineProps({
  name: { type: String, required: true },
  size: { type: Number, default: 20 },
});

const paths = {
  sparkles: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z',
  image: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm3 4a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM5 17l4.5-6 3.5 4 2.5-2.5L19 17H5z',
  camera: 'M9 3h6l2 3h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l2-3zm3 14a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0-2a3 3 0 1 1 0-6 3 3 0 0 1 0 6z',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-3.3 0-7 1.7-7 4v3h14v-3c0-2.3-3.7-4-7-4zm8.5-1.5A3.5 3.5 0 1 0 14 8c.5.9.8 1.9.8 3 0 1.1-.3 2.1-.8 3 3 .1 4.5 2 4.5 4v1h4v-2c0-2.6-3-4-5.5-4.5z',
  smile: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zm-5-9a5 5 0 0 0 10 0h-2a3 3 0 0 1-6 0H7zm2.5-3.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm5 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  megaphone: 'M3 11v2a1 1 0 0 0 1 1h2l4 5h2v-6h-2l4-5H4a1 1 0 0 0-1 1zm15.5-2.5A7 7 0 0 1 20 12c0 .7-.1 1.3-.3 1.9M18 6.6a9.5 9.5 0 0 1 0 10.8M21 4.5a13 13 0 0 1 0 15',
  layout: 'M4 4h16v16H4V4zm2 6h12V6H6v4zm0 2v6h5v-6H6zm7 0v6h5v-6h-5z',
  upload: 'M12 16V4m0 0l-4 4m4-4l4 4M4 20h16',
  download: 'M12 3v12m0 0l-4-4m4 4l4-4M4 21h16',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zm1-15h-2v6l5 3 1-1.5-4-2.5V7z',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.4-3a7.4 7.4 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7.6 7.6 0 0 0-1.7-1L14.6 3h-4l-.6 2.5a7.6 7.6 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a7.4 7.4 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7.6 7.6 0 0 0 1.7 1l.6 2.5h4l.6-2.5a7.6 7.6 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5c.1-.3.1-.7.1-1z',
  logout: 'M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l-5-5 5-5M5 12h11',
  arrowLeft: 'M19 12H5m0 0l6 6m-6-6l6-6',
  arrowRight: 'M5 12h14m0 0l-6-6m6 6l-6 6',
  refresh: 'M4 12a8 8 0 0 1 14-5.5M20 12a8 8 0 0 1-14 5.5M20 2v5h-5M4 22v-5h5',
  check: 'M5 13l4 4L19 7',
  x: 'M6 6l12 12M18 6L6 18',
  loader: 'M12 3a9 9 0 1 0 9 9',
  wallet: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7zm5-2v4m0 4h8a2 2 0 1 0 0-4H8',
  zap: 'M13 2L3 14h7l-1 8 11-14h-7l1-6z',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zm0-6.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  key: 'M21 2l-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.8 7.8 5.5 5.5 0 0 1 7.8-7.8zm0 0L15.5 7l3 3 2-2-3-3 2-2 3 3',
  heart: 'M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
};

const viewBox = { key: '0 0 24 24' };
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    :aria-hidden="true"
  >
    <path v-if="paths[name]" :d="paths[name]" />
    <path v-else d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
  </svg>
</template>
