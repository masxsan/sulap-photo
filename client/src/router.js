import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from './stores/auth';

const routes = [
  { path: '/', name: 'landing', component: () => import('./views/LandingView.vue') },
  { path: '/login', name: 'login', component: () => import('./views/LoginView.vue') },
  { path: '/register', name: 'register', component: () => import('./views/RegisterView.vue') },
  { path: '/app', name: 'dashboard', component: () => import('./views/DashboardView.vue'), meta: { auth: true } },
  { path: '/f/:id', name: 'feature', component: () => import('./views/FeatureView.vue'), meta: { auth: true } },
  { path: '/history', name: 'history', component: () => import('./views/HistoryView.vue'), meta: { auth: true } },
  { path: '/settings', name: 'settings', component: () => import('./views/SettingsView.vue'), meta: { auth: true } },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (to.meta.auth && !auth.isLoggedIn) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  if ((to.name === 'login' || to.name === 'register') && auth.isLoggedIn) {
    return { name: 'dashboard' };
  }
  if (to.meta.auth && auth.isLoggedIn && !auth.user) {
    try {
      await auth.fetchMe();
    } catch {
      /* handled in store */
    }
  }
  return true;
});

export default router;
