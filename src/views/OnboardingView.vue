<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ChevronDown, MapPin } from 'lucide-vue-next'
import AppButton from '@/components/ui/AppButton.vue'
import AppField from '@/components/ui/AppField.vue'
import AppInput from '@/components/ui/AppInput.vue'
import CountryPicker from '@/components/currency/CountryPicker.vue'
import CurrencyPicker from '@/components/currency/CurrencyPicker.vue'
import { countryName } from '@/data/countries'
import { currencyForCountry, currencyName } from '@/data/currencies'
import { detectLocation } from '@/lib/geo'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import type { CurrencyCode } from '@/types/currency'

const { t, locale } = useI18n()
const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const toast = useToast()

const nickname = ref('')
const country = ref('')
const currency = ref<CurrencyCode>('USD')
const bankName = ref('')
const bankAccount = ref('')

const pickerOpen = ref(false)
const countryPickerOpen = ref(false)
const detecting = ref(false)
const saving = ref(false)
const error = ref('')

onMounted(() => {
  const profile = auth.profile
  nickname.value = profile?.nickname || auth.user?.displayName || ''
  country.value = profile?.country ?? ''
  currency.value = profile?.currency ?? 'USD'
  bankName.value = profile?.payment?.bankName ?? ''
  bankAccount.value = profile?.payment?.bankAccount ?? ''
})

function pickCountry(code: string): void {
  country.value = code
  const home = currencyForCountry(code)
  if (home) currency.value = home
  countryPickerOpen.value = false
}

/** Guesses the home currency from where the device is right now. */
async function detect(): Promise<void> {
  detecting.value = true
  try {
    const result = await detectLocation()
    const guessed = currencyForCountry(result.countryCode)
    if (guessed) currency.value = guessed
  } catch {
    toast.error(t('onboarding.detectFailed'))
  } finally {
    detecting.value = false
  }
}

async function submit(): Promise<void> {
  if (!nickname.value.trim()) {
    error.value = t('onboarding.nicknameRequired')
    return
  }

  error.value = ''
  saving.value = true

  try {
    const account = bankAccount.value.trim()
    await auth.updateProfile({
      nickname: nickname.value.trim(),
      country: country.value,
      currency: currency.value,
      payment: account ? { bankName: bankName.value.trim(), bankAccount: account } : null,
    })

    toast.success(t('onboarding.saved'))
    const next = typeof route.query.next === 'string' ? route.query.next : '/groups'
    await router.replace(next)
  } catch {
    toast.error(t('common.somethingWrong'))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <main class="mx-auto min-h-dvh w-full max-w-md px-6 py-12">
    <header>
      <h1 class="text-2xl font-semibold tracking-tight">{{ t('onboarding.title') }}</h1>
      <p class="mt-1.5 text-sm text-muted">{{ t('onboarding.subtitle') }}</p>
    </header>

    <form class="mt-9 space-y-6" @submit.prevent="submit">
      <AppField :label="t('onboarding.nickname')" for="nickname">
        <AppInput
          id="nickname"
          v-model="nickname"
          :placeholder="t('onboarding.nicknamePlaceholder')"
          autocomplete="nickname"
        />
        <p v-if="error" class="text-xs text-negative">{{ error }}</p>
      </AppField>

      <AppField :label="t('onboarding.country')">
        <button
          type="button"
          class="flex h-11 w-full items-center justify-between rounded-xl border border-border bg-surface px-3.5 text-sm transition-colors hover:border-border-strong"
          @click="countryPickerOpen = true"
        >
          <span :class="country ? 'font-medium' : 'text-faint'">
            {{ country ? countryName(country, locale) : t('onboarding.countryPlaceholder') }}
          </span>
          <ChevronDown class="size-4 shrink-0 text-muted" />
        </button>
      </AppField>

      <AppField :label="t('onboarding.homeCurrency')">
        <div class="flex gap-2">
          <button
            type="button"
            class="flex h-11 min-w-0 flex-1 items-center justify-between rounded-xl border border-border bg-surface px-3.5 text-sm transition-colors hover:border-border-strong"
            @click="pickerOpen = true"
          >
            <span class="font-medium">{{ currency }}</span>
            <span class="truncate pl-3 text-xs text-muted">{{ currencyName(currency) }}</span>
          </button>
          <AppButton variant="secondary" :loading="detecting" @click="detect">
            <template #icon><MapPin class="size-4" /></template>
            <span class="sr-only">{{ t('onboarding.detect') }}</span>
          </AppButton>
        </div>
      </AppField>

      <section class="rounded-card border border-border bg-surface-2 p-4">
        <h2 class="text-sm font-medium">{{ t('onboarding.paymentTitle') }}</h2>
        <p class="mt-1 text-xs leading-relaxed text-muted">{{ t('onboarding.paymentHint') }}</p>

        <div class="mt-4 space-y-3">
          <AppInput v-model="bankName" :placeholder="t('onboarding.bankName')" />
          <AppInput v-model="bankAccount" mono :placeholder="t('onboarding.bankAccount')" />
        </div>
      </section>

      <AppButton type="submit" block size="lg" :loading="saving">
        {{ t('onboarding.submit') }}
      </AppButton>
    </form>

    <CountryPicker
      :open="countryPickerOpen"
      :title="t('onboarding.country')"
      :selected="country"
      @close="countryPickerOpen = false"
      @select="pickCountry"
    />

    <CurrencyPicker
      :open="pickerOpen"
      :title="t('onboarding.homeCurrency')"
      :selected="currency"
      @close="pickerOpen = false"
      @select="currency = $event; pickerOpen = false"
    />
  </main>
</template>
