export const EFFECTS = {
  light: { kind: 'none', gradient: 'linear-gradient(180deg,#f8fafc,#f1f5f9)' },
  dark: { kind: 'none', gradient: 'linear-gradient(180deg,#0f172a,#1e293b)' },
  sakura: {
    kind: 'particles',
    type: 'petal',
    count: 16,
    colors: ['#f9a8d4', '#f472b6', '#fbcfe8', '#fda4af'],
    sizes: [6, 14],
    gradient: 'linear-gradient(180deg,#fff1f7,#ffe4f0,#fbcfe8)',
  },
  winter: {
    kind: 'particles',
    type: 'snow',
    count: 24,
    colors: ['#ffffff'],
    sizes: [3, 6],
    gradient: 'linear-gradient(180deg,#e0f2fe,#bae6fd,#7dd3fc)',
  },
  autumn: {
    kind: 'particles',
    type: 'leaf',
    count: 14,
    colors: ['#f97316', '#d97706', '#b91c1c', '#ca8a04'],
    sizes: [6, 12],
    gradient: 'linear-gradient(180deg,#fffbeb,#fde68a,#fdba74)',
  },
  galaxy: {
    kind: 'particles',
    type: 'star',
    count: 36,
    colors: ['#ffffff', '#a5b4fc', '#f0abfc'],
    sizes: [2, 4],
    gradient: 'linear-gradient(180deg,#0b1026,#1e1b4b,#312e81)',
    blobs: ['rgba(124,58,237,0.35)', 'rgba(217,70,239,0.25)', 'rgba(59,130,246,0.25)'],
  },
  rainy: {
    kind: 'particles',
    type: 'rain',
    count: 40,
    colors: ['#cbd5e1', '#e2e8f0'],
    sizes: [14, 22],
    gradient: 'linear-gradient(180deg,#64748b,#475569,#334155)',
  },
  cyberpunk: {
    kind: 'cyberpunk',
    gradient: 'linear-gradient(180deg,#0d0b1e,#1a0b2e,#12042a)',
  },
  ninja: {
    kind: 'particles',
    type: 'shuriken',
    count: 9,
    colors: ['#e11d48'],
    sizes: [12, 18],
    gradient: 'linear-gradient(180deg,#151515,#1f1f1f,#0a0a0a)',
  },
};

export function effectFor(themeId) {
  return EFFECTS[themeId] || EFFECTS.light;
}
