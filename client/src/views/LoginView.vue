<script setup>
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import AppIcon from '../components/AppIcon.vue';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const email = ref('');
const password = ref('');
const submitting = ref(false);

async function submit() {
  if (!email.value || !password.value) return;
  submitting.value = true;
  try {
    await auth.login({ email: email.value, password: password.value });
    router.push(route.query.redirect || { name: 'dashboard' });
  } catch {
    /* error di store */
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center px-4 bg-gradient-to-b from-white to-brand-50/40">
    <div class="w-full max-w-sm">
      <div class="text-center mb-8">
        <span class="inline-flex w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-white items-center justify-center">
          <AppIcon name="zap" :size="24" />
        </span>
        <h1 class="mt-4 font-display text-2xl font-extrabold text-slate-900">Masuk ke Sulap Photo</h1>
        <p class="text-sm text-slate-500 mt-1">Lanjutkan mengedit fotomu</p>
      </div>

      <form @submit.prevent="submit" class="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <p v-if="auth.error" class="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{{ auth.error }}</p>
        <div>
          <label class="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">Email</label>
          <input v-model="email" type="email" required class="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400" placeholder="nama@email.com" />
        </div>
        <div>
          <label class="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">Password</label>
          <input v-model="password" type="password" required class="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400" placeholder="••••••••" />
        </div>
        <button
          type="submit"
          :disabled="submitting || auth.loading"
          class="w-full py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
        >
          <span v-if="submitting" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
          Masuk
        </button>
      </form>

      <p class="text-center text-sm text-slate-500 mt-5">
        Belum punya akun?
        <router-link :to="{ name: 'register' }" class="text-brand-600 font-semibold hover:underline">Daftar gratis</router-link>
      </p>
    </div>
  </div>
</template>
