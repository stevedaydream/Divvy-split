import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { public: true } },
    { path: '/join', name: 'join', component: () => import('@/views/JoinView.vue'), meta: { public: true } },
    // Readable by anyone, signed in or not, with or without a profile.
    { path: '/privacy', name: 'privacy', component: () => import('@/views/PrivacyView.vue'), meta: { public: true, open: true } },
    { path: '/onboarding', name: 'onboarding', component: () => import('@/views/OnboardingView.vue') },
    { path: '/groups', name: 'groups', component: () => import('@/views/GroupsView.vue') },
    { path: '/groups/:id', name: 'group', component: () => import('@/views/GroupDetailView.vue'), props: true },
    { path: '/calculator', name: 'calculator', component: () => import('@/views/CalculatorView.vue') },
    { path: '/profile', name: 'profile', component: () => import('@/views/ProfileView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/groups' },
  ],
  scrollBehavior: (_to, _from, saved) => saved ?? { top: 0 },
})

/**
 * The auth store resolves `init()` once per app load. Awaiting it here is what
 * replaced re-subscribing to `onAuthStateChanged` and re-reading the profile
 * document on every single navigation.
 */
router.beforeEach(async (to) => {
  if (to.meta.open) return true

  const auth = useAuthStore()
  await auth.init()

  if (!auth.isSignedIn) {
    // `/join` handles its own sign-in prompt so the invite survives the redirect.
    return to.meta.public ? true : { name: 'login', query: to.fullPath !== '/' ? { next: to.fullPath } : undefined }
  }

  if (!auth.hasProfile && to.name !== 'onboarding') {
    return { name: 'onboarding', query: { next: to.fullPath } }
  }

  if (to.name === 'login') return { name: 'groups' }

  return true
})

export default router
