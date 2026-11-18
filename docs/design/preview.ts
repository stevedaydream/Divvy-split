import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import { i18n } from '../../src/i18n'
import { useRatesStore } from '../../src/stores/rates'
import Preview from './Preview.vue'
import '../../src/styles/main.css'
const pinia = createPinia()
const app = createApp(Preview).use(pinia).use(i18n)
const rates = useRatesStore(pinia)
rates.rates = { USD: 1, TWD: 32, JPY: 150, EUR: .92, KRW: 1350 }
rates.fetchedAt = Date.now()
// Isolated component fixture: no real API calls, authentication or Firestore writes.
rates.load = async () => {}
const router = createRouter({ history: createWebHashHistory(), routes: ['groups', 'calculator', 'profile', 'privacy'].map(name => ({ path: '/' + name, name, component: { template: '<div />' } })) })
app.use(router)
router.replace('/groups')
app.mount('#app')
