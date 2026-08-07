<script setup>
import { ref, onMounted } from 'vue';
import { api } from '../api';
import { useAuthStore } from '../stores/auth';
import NavBar from '../components/NavBar.vue';
import AppIcon from '../components/AppIcon.vue';

const auth = useAuthStore();
const apiKey = ref('');
const baseUrl = ref('');
const model = ref('');
const transactions = ref([]);
const saving = ref(false);
const saved = ref(false);
const message = ref('');
const error = ref('');
const testing = ref(false);
const testResult = ref(null);

onMounted(async () => {
  await auth.fetchMe();
  try {
    const data = await api.get('/wallet/transactions');
    transactions.value = data.transactions;
  } catch {
    /* ignore */
  }
});

async function saveProvider() {
  saving.value = true;
  saved.value = false;
  error.value = '';
  message.value = '';
  try {
    await auth.saveProvider({
      apiKey: apiKey.value.trim(),
      baseUrl: baseUrl.value.trim(),
      model: model.value.trim(),
    });
    saved.value = true;
    setTimeout(() => (saved.value = false), 2500);
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}

async function testProvider() {
  testing.value = true;
  testResult.value = null;
  try {
    testResult.value = await api.post('/me/provider/test', {
      apiKey: apiKey.value.trim(),
      baseUrl: baseUrl.value.trim(),
      model: model.value.trim(),
    });
  } catch (e) {
    testResult.value = { ok: false, message: e.message };
  } finally {
    testing.value = false;
  }
}

const typeLabel = (t) => ({
  signup_bonus: 'Bonus pendaftaran',
  consume: 'Biaya generate',
  refund: 'Refund',
  grant: 'Top-up admin',
  theme_purchase: 'Beli tema',
}[t] || t);

const typeColor = (t) => (t === 'consume' || t === 'theme_purchase' ? 'text-red-500' : 'text-emerald-600');
</script>

<template>
  <div class="min-h-screen">
    <NavBar />
    <main class="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <h1 class="font-display text-2xl font-extrabold text-slate-900">Pengaturan</h1>

      <!-- Provider AI -->
      <section class="bg-white border border-slate-200 rounded-2xl p-5 md:p-6">
        <div class="flex items-center gap-2 mb-1">
          <span class="w-8 h-8 rounded-lg bg-brand-50 text-brand-500 flex items-center justify-center">
            <AppIcon name="key" :size="17" />
          </span>
          <h2 class="font-bold text-slate-800">API Key AI (OpenAI-compatible)</h2>
        </div>
        <p class="text-sm text-slate-500 mb-4">
          Opsional. Tanpa API key, aplikasi memakai engine gratis (Pollinations) yang hanya mendukung fitur berbasis teks.
          Dengan API key, semua fitur (termasuk upload foto) aktif. API key tersimpan hanya di akun Anda.
        </p>

        <div class="space-y-3">
          <div>
            <label class="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">API Key</label>
            <input v-model="apiKey" type="password" class="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400" placeholder="sk-..." />
          </div>
          <div class="grid sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">Base URL (opsional)</label>
              <input v-model="baseUrl" type="text" class="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400" placeholder="https://api.openai.com/v1" />
            </div>
            <div>
              <label class="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">Model (opsional)</label>
              <input v-model="model" type="text" class="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400" placeholder="gpt-image-1" />
            </div>
          </div>
          <p v-if="message" class="text-sm text-emerald-600">{{ message }}</p>
          <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
          <div v-if="testResult" class="text-sm rounded-lg px-3 py-2 border" :class="testResult.ok ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-700 bg-red-50 border-red-200'">
            <span class="font-bold">{{ testResult.ok ? 'Terhubung' : 'Gagal' }}</span> — {{ testResult.message }}
          </div>
          <div class="flex items-center gap-2">
            <button
              @click="saveProvider"
              :disabled="saving"
              class="px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold disabled:opacity-50 inline-flex items-center gap-2 transition-colors"
            >
              <span v-if="saving" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              {{ saved ? 'Tersimpan ✓' : 'Simpan' }}
            </button>
            <button
              @click="testProvider"
              :disabled="testing"
              class="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 hover:border-brand-400 hover:text-brand-600 font-semibold disabled:opacity-50 inline-flex items-center gap-2 transition-colors"
            >
              <span v-if="testing" class="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></span>
              <AppIcon v-else name="zap" :size="15" />
              Tes Koneksi
            </button>
          </div>
        </div>
      </section>

      <!-- Wallet -->
      <section class="bg-white border border-slate-200 rounded-2xl p-5 md:p-6">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <span class="w-8 h-8 rounded-lg bg-brand-50 text-brand-500 flex items-center justify-center">
              <AppIcon name="wallet" :size="17" />
            </span>
            <h2 class="font-bold text-slate-800">Riwayat Kredit</h2>
          </div>
          <span class="text-sm font-bold text-slate-800 tabular-nums">{{ auth.credits.toLocaleString('id-ID') }} kredit</span>
        </div>

        <div v-if="!transactions.length" class="text-sm text-slate-400 py-6 text-center">Belum ada transaksi.</div>
        <ul v-else class="divide-y divide-slate-100">
          <li v-for="tx in transactions" :key="tx.id" class="flex items-center justify-between py-2.5">
            <div>
              <p class="text-sm font-medium text-slate-700">{{ typeLabel(tx.type) }}</p>
              <p class="text-xs text-slate-400">{{ new Date(tx.created_at + ' UTC').toLocaleString('id-ID') }}</p>
            </div>
            <span class="text-sm font-bold tabular-nums" :class="typeColor(tx.type)">
              {{ tx.amount > 0 ? '+' : '' }}{{ tx.amount.toLocaleString('id-ID') }}
            </span>
          </li>
        </ul>

        <p class="mt-4 text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2">
          Untuk pengembang: top-up kredit pengguna bisa dilakukan via API admin
          <code class="text-brand-600 font-mono">POST /api/admin/credits</code> dengan header <code class="text-brand-600 font-mono">x-admin-key</code>.
        </p>
      </section>
    </main>
  </div>
</template>
