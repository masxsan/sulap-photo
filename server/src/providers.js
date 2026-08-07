// Provider AI. Setiap provider mengekspor generate({ feature, prompt, images, ratio, model, config })
// yang mengembalikan Buffer gambar.
const config = require('./config');

function ratioSize(ratio, { forOpenAI = false } = {}) {
  const r = ratio || '1:1';
  const mapOpenAI = {
    '1:1': '1024x1024',
    '16:9': '1280x720',
    '9:16': '720x1280',
    '4:3': '1024x768',
    '3:4': '768x1024',
    '3:2': '1152x768',
    '2:3': '768x1152',
  };
  const mapPx = {
    '1:1': [1024, 1024],
    '16:9': [1280, 720],
    '9:16': [720, 1280],
    '4:3': [1024, 768],
    '3:4': [768, 1024],
    '3:2': [1152, 768],
    '2:3': [768, 1152],
  };
  if (forOpenAI) return mapOpenAI[r] || mapOpenAI['1:1'];
  return mapPx[r] || mapPx['1:1'];
}

async function pollinations({ prompt, ratio, model }) {
  const [w, h] = ratioSize(ratio);
  const m = model || config.pollinationsModel;
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(
    prompt
  )}?width=${w}&height=${h}&nologo=true&model=${m}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 120000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { accept: 'image/*' },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Pollinations gagal (${res.status}): ${text.slice(0, 200)}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 100) throw new Error('Pollinations mengembalikan gambar kosong');
    return buf;
  } finally {
    clearTimeout(timer);
  }
}

async function openaiCompat({ feature, prompt, images, ratio, model, apiKey, baseUrl }) {
  const base = (baseUrl || config.openaiBaseUrl).replace(/\/+$/, '');
  const m = model || config.openaiModel;
  const size = ratioSize(ratio, { forOpenAI: true });
  const headers = {
    Authorization: `Bearer ${apiKey}`,
  };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 180000);

  try {
    let data;
    if (feature.type === 'img2img') {
      // /images/edits (multipart)
      const form = new FormData();
      const img = images[0];
      form.append('image', new Blob([img.buffer], { type: img.mime || 'image/png' }), 'input.png');
      form.append('prompt', prompt);
      form.append('model', m);
      form.append('size', size);
      form.append('n', '1');
      form.append('response_format', 'b64_json');
      const res = await fetch(`${base}/images/edits`, {
        method: 'POST',
        headers,
        body: form,
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`API gambar gagal (${res.status}): ${text.slice(0, 200)}`);
      }
      data = await res.json();
    } else {
      // /images/generations (json)
      const res = await fetch(`${base}/images/generations`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: m,
          prompt,
          size,
          n: 1,
          response_format: 'b64_json',
        }),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`API gambar gagal (${res.status}): ${text.slice(0, 200)}`);
      }
      data = await res.json();
    }

    const item = data?.data?.[0];
    if (!item) throw new Error('Provider tidak mengembalikan hasil gambar');
    if (item.b64_json) return Buffer.from(item.b64_json, 'base64');
    if (item.url) {
      const r = await fetch(item.url, { signal: ctrl.signal });
      if (!r.ok) throw new Error('Gagal mengunduh hasil dari provider');
      return Buffer.from(await r.arrayBuffer());
    }
    throw new Error('Format hasil provider tidak dikenali');
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { pollinations, openaiCompat, ratioSize };
