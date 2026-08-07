import { defineStore } from 'pinia';
import { api } from '../api';

export const useCatalogStore = defineStore('catalog', {
  state: () => ({
    categories: [],
    features: [],
    loading: false,
  }),
  getters: {
    byCategory: (s) =>
      s.categories
        .map((cat) => ({
          ...cat,
          features: s.features.filter((f) => f.category === cat.id),
        }))
        .filter((cat) => cat.features.length),
    getFeature: (s) => (id) => s.features.find((f) => f.id === id) || null,
  },
  actions: {
    async fetch() {
      if (this.loading || this.features.length) return;
      this.loading = true;
      try {
        const data = await api.get('/features');
        this.categories = data.categories;
        this.features = data.features;
      } finally {
        this.loading = false;
      }
    },
  },
});
