<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import AppIcon from '../components/AppIcon.vue';

const auth = useAuthStore();
const router = useRouter();

const name = ref('');
const email = ref('');
const password = ref('');
const submitting = ref(false);

async function submit() {
  if (!name.value || !email.value || !password.value) return;
  submitting.value = true;
  try {
    await auth.register({ name: name.value, email: email.value, password: password.value });
    router.push({ name: 'dashboard' });
  } catch {
    /* error di store */
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center px-4 py-10">
    <div class="w-full max-w-sm">
      <div class="text-center mb-8">
        <span class="inline-flex w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-white items-center justify-center">
          <AppIcon name="zap" :size="24" />
        </span>
        <h1 class="mt-4 font-display text-2xl font-extrabold text-slate-900">Buat Akun</h1>
        <p class="text-sm text-slate-500 mt-1">Dapatkan {{ auth.user ? '' : '' }} bonus kredit gratis untuk mulai</p>
      </div>

      <form @submit.prevent="submit" class="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <p v-if="auth.error" class="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{{ auth.error }}</p>
        <div>
          <label class="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">Nama</label>
          <input v-model="name" type="text" required class="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400" placeholder="Nama Anda" />
        </div>
        <div>
          <label class="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">Email</label>
          <input v-model="email" type="email" required class="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400" placeholder="nama@email.com" />
        </div>
        <div>
          <label class="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">Password</label>
          <input v-model="password" type="password" required minlength="6" class="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400" placeholder="Minimal 6 karakter" />
        </div>
        <button
          type="submit"
          :disabled="submitting || auth.loading"
          class="w-full py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
        >
          <span v-if="submitting" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
          Daftar Gratis
        </button>
      </form>

      <p class="text-center text-sm text-slate-500 mt-5">
        Sudah punya akun?
        <router-link :to="{ name: 'login' }" class="text-brand-600 font-semibold hover:underline">Masuk</router-link>
      </p>
    </div>
  </div>
</template>
