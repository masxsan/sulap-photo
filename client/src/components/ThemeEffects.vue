<script setup>
import { computed } from 'vue';
import { useThemeStore } from '../stores/theme';
import { effectFor } from '../themes-ui';

const theme = useThemeStore();

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

const cfg = computed(() => effectFor(theme.id));

const particles = computed(() => {
  const c = cfg.value;
  if (!theme.enableAnimation || c.kind !== 'particles') return [];
  const isStar = c.type === 'star';
  const list = [];
  for (let i = 0; i < c.count; i++) {
    const size = rand(c.sizes[0], c.sizes[1]);
    list.push({
      id: i,
      type: c.type,
      left: rand(0, 100),
      top: isStar ? rand(0, 100) : rand(-12, 0),
      size,
      color: pick(c.colors),
      duration: c.type === 'rain' ? rand(0.7, 1.3) : isStar ? rand(2.5, 6) : rand(6, 14),
      delay: isStar ? -rand(0, 6) : -rand(0, 14),
      sway: rand(-70, 70),
      rotate: rand(0, 360),
      drift: rand(0, 30),
      opacity: rand(0.55, 1),
    });
  }
  return list;
});

const blobs = computed(() => {
  const c = cfg.value;
  if (!theme.enableAnimation || !c.blobs) return [];
  return c.blobs.map((color, i) => ({
    id: i,
    color,
    left: rand(0, 80),
    top: rand(0, 60),
    size: rand(220, 420),
    duration: rand(14, 22),
    delay: -rand(0, 20),
  }));
});
</script>

<template>
  <div class="sp-backdrop" aria-hidden="true" :style="{ background: cfg.gradient }">
    <template v-if="theme.enableAnimation">
      <div v-if="cfg.kind === 'cyberpunk'" class="sp-cyberpunk">
        <div class="sp-cyberpunk-grid"></div>
        <div class="sp-cyberpunk-glow g1"></div>
        <div class="sp-cyberpunk-glow g2"></div>
        <div class="sp-cyberpunk-scan"></div>
      </div>

      <span v-for="b in blobs" :key="'b' + b.id" class="sp-blob" :style="blobStyle(b)"></span>

      <span
        v-for="p in particles"
        :key="p.id"
        class="sp-p"
        :class="'sp-' + p.type"
        :style="particleStyle(p)"
      ></span>
    </template>
  </div>
</template>

<script>
function particleStyle(p) {
  const fall = p.type === 'star' ? `translateY(${p.drift}px)` : `translateY(${110 + p.drift}vh)`;
  const isRain = p.type === 'rain';
  const st = {
    left: p.left + 'vw',
    top: p.top + 'vh',
    width: isRain ? '2px' : p.size + 'px',
    height: isRain ? p.size * 12 + 6 + 'px' : p.size + 'px',
    opacity: p.opacity,
    animationDuration: p.duration + 's',
    animationDelay: p.delay + 's',
    ['--sx']: p.sway + 'px',
    ['--rot']: p.rotate + 'deg',
    ['--fy']: fall,
  };
  if (p.type !== 'rain' && p.type !== 'shuriken') st.background = p.color;
  return st;
}

function blobStyle(b) {
  return {
    left: b.left + 'vw',
    top: b.top + 'vh',
    width: b.size + 'px',
    height: b.size + 'px',
    background: `radial-gradient(circle, ${b.color} 0%, transparent 70%)`,
    animationDuration: b.duration + 's',
    animationDelay: b.delay + 's',
  };
}
</script>
