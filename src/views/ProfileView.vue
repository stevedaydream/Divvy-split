<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Eye, EyeOff, LogOut, Pencil } from 'lucide-vue-next'
import AppShell from '@/components/layout/AppShell.vue'
import TopBar from '@/components/layout/TopBar.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppAvatar from '@/components/ui/AppAvatar.vue'
import CurrencyPicker from '@/components/currency/CurrencyPicker.vue'
import { currencyName } from '@/data/currencies'
import { setLocale, type Locale } from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import { useGroupsStore } from '@/stores/groups'
import { useConfirm } from '@/composables/useConfirm'
import { useTheme, type Theme } from '@/composables/useTheme'
import { useToast } from '@/composables/useToast'
import type { CurrencyCode } from '@/types/currency'

const { t, locale } = useI18n()
const auth = useAuthStore()
const groups = useGroupsStore()
const router = useRouter()
const toast = useToast()
const { confirm } = useConfirm()
const { theme, followsSystem, setTheme, useSystem } = useTheme()

const revealed = ref(false)
const pickerOpen = ref(false)

const profile = computed(() => auth.profile)

const maskedAccount = computed(() => {
  const account = profile.value?.payment?.bankAccount
  if (!account) return ''
  return account.length <= 4 ? '••••' : `•••• ${account.slice(-4)}`
})

const themeChoice = computed<Theme | 'system'>(() => (followsSystem.value ? 'system' : theme.value))

function chooseTheme(choice: Theme | 'system'): void {
  if (choice === 'system') useSystem()
  else setTheme(choice)
}

function chooseLocale(next: Locale): void {
  setLocale(next)
}

async function changeCurrency(next: CurrencyCode): Promise<void> {
  pickerOpen.value = false
  try {
    await auth.updateProfile({ currency: next })
    toast.success(t('profile.updated'))
  } catch {
    toast.error(t('common.somethingWrong'))
  }
}

async function signOut(): Promise<void> {
  const confirmed = await confirm({
    title: t('profile.signOutTitle'),
    message: t('profile.signOutMessage'),
    confirmLabel: t('profile.signOut'),
    tone: 'danger',
  })
  if (!confirmed) return

  groups.reset()
  await auth.logout()
  await router.replace({ name: 'login' })
}
</script>

<template>
  <AppShell nav>
    <TopBar :title="t('profile.title')" />

    <div class="space-y-6 px-5 py-5">
      <section class="flex items-center gap-4 rounded-card border border-border bg-surface p-5 shadow-card">
        <AppAvatar :name="profile?.nickname ?? '?'" size="lg" />
        <div class="min-w-0">
          <h2 class="truncate text-base font-semibold">{{ profile?.nickname }}</h2>
          <p class="truncate text-xs text-muted">{{ auth.user?.email }}</p>
        </div>
      </section>

      <section class="overflow-hidden rounded-card border border-border bg-surface shadow-card">
        <h3 class="border-b border-border px-5 py-3 text-xs font-medium text-muted">
          {{ t('profile.payment') }}
        </h3>

        <div class="flex items-center justify-between px-5 py-4">
          <div class="min-w-0">
            <p v-if="!profile?.payment || profile.payment.bankName" class="truncate text-sm font-medium">
              {{ profile?.payment?.bankName || t('profile.noPayment') }}
            </p>
            <p v-if="profile?.payment?.bankAccount" class="tabular mt-0.5 font-mono text-sm text-muted">
              {{ revealed ? profile.payment.bankAccount : maskedAccount }}
            </p>
            <p v-if="profile?.payment?.lineId" class="mt-0.5 truncate text-sm text-muted">
              LINE ID · {{ profile.payment.lineId }}
            </p>
          </div>

          <button
            v-if="profile?.payment?.bankAccount"
            class="grid size-9 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-fg"
            :aria-label="revealed ? t('profile.hide') : t('profile.reveal')"
            @click="revealed = !revealed"
          >
            <component :is="revealed ? EyeOff : Eye" class="size-4" />
          </button>
        </div>
      </section>

      <section class="overflow-hidden rounded-card border border-border bg-surface shadow-card">
        <h3 class="border-b border-border px-5 py-3 text-xs font-medium text-muted">
          {{ t('profile.preferences') }}
        </h3>

        <button
          class="flex w-full items-center justify-between border-b border-border px-5 py-4 text-left transition-colors hover:bg-surface-2"
          @click="pickerOpen = true"
        >
          <span class="text-sm">{{ t('profile.homeCurrency') }}</span>
          <span class="flex items-center gap-2 text-sm text-muted">
            <span class="font-medium text-fg">{{ profile?.currency }}</span>
            <span class="hidden text-xs sm:inline">{{ currencyName(profile?.currency ?? '') }}</span>
          </span>
        </button>

        <div class="flex items-center justify-between border-b border-border px-5 py-3.5">
          <span class="text-sm">{{ t('profile.language') }}</span>
          <div class="flex gap-1 rounded-lg bg-surface-2 p-0.5">
            <button
              v-for="option in (['en', 'zh-TW'] as const)"
              :key="option"
              class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
              :class="locale === option ? 'bg-surface text-fg shadow-card' : 'text-muted'"
              @click="chooseLocale(option)"
            >
              {{ option === 'en' ? 'EN' : '繁中' }}
            </button>
          </div>
        </div>

        <div class="flex items-center justify-between px-5 py-3.5">
          <span class="text-sm">{{ t('profile.theme') }}</span>
          <div class="flex gap-1 rounded-lg bg-surface-2 p-0.5">
            <button
              v-for="option in (['light', 'dark', 'system'] as const)"
              :key="option"
              class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
              :class="themeChoice === option ? 'bg-surface text-fg shadow-card' : 'text-muted'"
              @click="chooseTheme(option)"
            >
              {{ t(`profile.theme${option[0]!.toUpperCase()}${option.slice(1)}`) }}
            </button>
          </div>
        </div>
      </section>

      <div class="grid grid-cols-2 gap-3">
        <AppButton variant="secondary" @click="router.push({ name: 'onboarding' })">
          <template #icon><Pencil class="size-4" /></template>
          {{ t('profile.editProfile') }}
        </AppButton>
        <AppButton variant="danger" @click="signOut">
          <template #icon><LogOut class="size-4" /></template>
          {{ t('profile.signOut') }}
        </AppButton>
      </div>
    </div>

    <CurrencyPicker
      :open="pickerOpen"
      :title="t('profile.homeCurrency')"
      :selected="profile?.currency"
      @close="pickerOpen = false"
      @select="changeCurrency"
    />
  </AppShell>
</template>
