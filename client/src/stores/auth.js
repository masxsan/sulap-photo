import { defineStore } from 'pinia';
import { api, setToken, getToken } from '../api';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: getToken(),
    user: null,
    loading: false,
    error: '',
  }),
  getters: {
    isLoggedIn: (s) => !!s.token,
    credits: (s) => s.user?.credits ?? 0,
    providerConfigured: (s) => s.user?.providerConfigured ?? false,
  },
  actions: {
    setSession({ token, user }) {
      this.token = token;
      this.user = user;
      setToken(token);
    },
    async register({ name, email, password }) {
      this.loading = true;
      this.error = '';
      try {
        const data = await api.post('/auth/register', { name, email, password });
        this.setSession(data);
      } catch (e) {
        this.error = e.message;
        throw e;
      } finally {
        this.loading = false;
      }
    },
    async login({ email, password }) {
      this.loading = true;
      this.error = '';
      try {
        const data = await api.post('/auth/login', { email, password });
        this.setSession(data);
      } catch (e) {
        this.error = e.message;
        throw e;
      } finally {
        this.loading = false;
      }
    },
    async fetchMe() {
      if (!this.token) return;
      try {
        const data = await api.get('/me');
        this.user = data.user;
      } catch {
        this.logout();
      }
    },
    async saveProvider({ apiKey, baseUrl, model }) {
      const data = await api.patch('/me/provider', { apiKey, baseUrl, model });
      this.user = data.user;
    },
    logout() {
      this.token = null;
      this.user = null;
      setToken(null);
    },
  },
});
