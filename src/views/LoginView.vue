<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AppButton from '@/components/ui/AppButton.vue'
import AppFooter from '@/components/layout/AppFooter.vue'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'

const { t } = useI18n()
const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const toast = useToast()

const signingIn = ref(false)

async function signIn(): Promise<void> {
  signingIn.value = true
  try {
    await auth.signIn()
    const next = typeof route.query.next === 'string' ? route.query.next : '/groups'
    await router.replace(auth.hasProfile ? next : { name: 'onboarding', query: { next } })
  } catch {
    toast.error(t('login.failed'))
  } finally {
    signingIn.value = false
  }
}
</script>

<template>
  <main class="flex min-h-dvh flex-col px-6">
    <div class="mx-auto my-auto w-full max-w-xs pt-12 text-center">
      <div class="mx-auto grid size-14 place-items-center rounded-2xl bg-accent text-accent-fg">
        <span class="text-2xl font-semibold">D</span>
      </div>

      <h1 class="mt-7 text-2xl font-semibold tracking-tight">Divvy</h1>
      <p class="mt-2 text-sm leading-relaxed text-muted">{{ t('login.tagline') }}</p>

      <AppButton class="mt-9" block size="lg" :loading="signingIn" @click="signIn">
        <template #icon>
          <svg class="size-4" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
        </template>
        {{ t('login.signIn') }}
      </AppButton>

      <p class="mt-6 text-xs leading-relaxed text-faint">{{ t('login.secure') }}</p>
    </div>
    <AppFooter />
  </main>
</template>
