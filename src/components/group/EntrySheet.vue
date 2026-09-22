<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppSheet from '@/components/ui/AppSheet.vue'
import AmountInput from '@/components/currency/AmountInput.vue'
import CurrencyPicker from '@/components/currency/CurrencyPicker.vue'
import { convertMinor, formatNumber, toMajor, toMinor } from '@/lib/money'
import { useRatesStore } from '@/stores/rates'
import type { EntryDraft } from '@/services/entries'
import type { CurrencyCode } from '@/types/currency'
import type { Entry, EntryType, Group } from '@/types/models'

const props = defineProps<{
  open: boolean
  group: Group
  uid: string
  /** Set when editing; null when adding. */
  entry: Entry | null
  /** Pre-selects the settlement tab and recipient from a settlement plan. */
  presetSettlement: { to: string; amountMinor: number } | null
  locale: string
}>()

const emit = defineEmits<{ close: []; save: [draft: EntryDraft] }>()

const { t } = useI18n()
const rates = useRatesStore()

const tab = ref<EntryType>('expense')
const title = ref('')
const amount = ref('')
const currency = ref<CurrencyCode>(props.group.currency)
const participants = ref<string[]>([])
const recipient = ref<string | null>(null)
const pickerOpen = ref(false)
const error = ref('')

/**
 * Editing reuses the entry's stored rate, so re-saving an old entry without
 * touching the amount leaves the converted figure exactly where it was.
 * A new amount or currency re-prices at today's rate.
 */
const originalRate = ref<number | null>(null)

const others = computed(() => props.group.memberIds.filter((uid) => uid !== props.uid))

const liveRate = computed(() => rates.rate(currency.value, props.group.currency))

const effectiveRate = computed(() => {
  if (currency.value === props.group.currency) return 1
  const entry = props.entry
  const unchanged =
    entry &&
    originalRate.value !== null &&
    entry.currency === currency.value &&
    entry.amountMinor === toMinor(amount.value, currency.value)
  return unchanged ? originalRate.value! : liveRate.value
})

const convertedMinor = computed(() =>
  convertMinor(toMinor(amount.value, currency.value), currency.value, props.group.currency, effectiveRate.value),
)

const showConversion = computed(() => currency.value !== props.group.currency && amount.value !== '')

watch(
  () => props.open,
  (open) => {
    if (!open) return
    error.value = ''
    pickerOpen.value = false

    const entry = props.entry
    if (entry) {
      tab.value = entry.type
      title.value = entry.title
      amount.value = String(toMajor(entry.amountMinor, entry.currency))
      currency.value = entry.currency
      participants.value = entry.type === 'expense' ? [...entry.participantIds] : []
      recipient.value = entry.type === 'settlement' ? (entry.participantIds[0] ?? null) : null
      originalRate.value = entry.rate
      return
    }

    originalRate.value = null
    currency.value = props.group.currency
    title.value = ''

    const preset = props.presetSettlement
    if (preset) {
      tab.value = 'settlement'
      recipient.value = preset.to
      amount.value = String(toMajor(preset.amountMinor, props.group.currency))
      participants.value = []
    } else {
      tab.value = 'expense'
      recipient.value = null
      amount.value = ''
      participants.value = [...props.group.memberIds]
    }
  },
)

function toggleParticipant(uid: string): void {
  participants.value = participants.value.includes(uid)
    ? participants.value.filter((id) => id !== uid)
    : [...participants.value, uid]
}

function toggleAll(): void {
  participants.value =
    participants.value.length === props.group.memberIds.length ? [] : [...props.group.memberIds]
}

function submit(): void {
  const amountMinor = toMinor(amount.value, currency.value)
  if (amountMinor <= 0) {
    error.value = t('group.amountRequired')
    return
  }

  const isSettlement = tab.value === 'settlement'
  if (isSettlement && !recipient.value) {
    error.value = t('settle.payTo')
    return
  }
  if (!isSettlement && participants.value.length === 0) {
    error.value = t('group.splitNobody')
    return
  }

  error.value = ''

  emit('save', {
    groupId: props.group.id,
    type: tab.value,
    title: isSettlement ? t('group.settlement') : title.value.trim() || t('group.expense'),
    payerId: props.uid,
    participantIds: isSettlement ? [recipient.value!] : [...participants.value],
    amountMinor,
    currency: currency.value,
    rate: effectiveRate.value,
    groupAmountMinor: convertedMinor.value,
  })
}
</script>

<template>
  <AppSheet
    :open="open"
    :title="entry ? t('common.edit') : t('group.addExpense')"
    @close="emit('close')"
  >
    <div v-if="!entry" class="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1">
      <button
        v-for="option in (['expense', 'settlement'] as const)"
        :key="option"
        class="rounded-lg py-2 text-sm font-medium transition-colors"
        :class="tab === option ? 'bg-surface text-fg shadow-card' : 'text-muted'"
        @click="tab = option"
      >
        {{ t(`group.${option}`) }}
      </button>
    </div>

    <AmountInput
      v-model="amount"
      :currency="currency"
      @pick-currency="pickerOpen = true"
    />

    <p v-if="showConversion" class="mt-2 text-center text-xs text-muted">
      {{ t('group.converts', {
        amount: formatNumber(convertedMinor, group.currency, locale),
        currency: group.currency,
      }) }}
    </p>

    <div v-if="tab === 'expense'" class="mt-7 space-y-6">
      <AppInput v-model="title" :placeholder="t('group.whatPlaceholder')" />

      <section>
        <div class="mb-2 flex items-center justify-between">
          <h3 class="text-xs font-medium text-muted">{{ t('group.splitWith') }}</h3>
          <button class="text-xs font-medium text-accent" @click="toggleAll">
            {{ t('group.splitAll') }}
          </button>
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            v-for="uid in group.memberIds"
            :key="uid"
            class="rounded-lg border px-3 py-1.5 text-sm transition-colors"
            :class="
              participants.includes(uid)
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-border text-muted'
            "
            @click="toggleParticipant(uid)"
          >
            {{ group.members[uid]?.nickname }}
          </button>
        </div>
      </section>
    </div>

    <section v-else class="mt-7">
      <h3 class="mb-2 text-xs font-medium text-muted">{{ t('settle.payTo') }}</h3>

      <div class="flex flex-wrap gap-2">
        <button
          v-for="uid in others"
          :key="uid"
          class="rounded-lg border px-3 py-1.5 text-sm transition-colors"
          :class="
            recipient === uid
              ? 'border-accent bg-accent-soft text-accent'
              : 'border-border text-muted'
          "
          @click="recipient = uid"
        >
          {{ group.members[uid]?.nickname }}
        </button>
      </div>

      <div
        v-if="recipient"
        class="mt-4 rounded-card border border-border bg-surface-2 p-4"
      >
        <h4 class="text-xs font-medium text-muted">{{ t('settle.recipientDetails') }}</h4>
        <template v-if="group.members[recipient]?.payment">
          <p class="mt-1.5 text-sm font-medium">{{ group.members[recipient]?.payment?.bankName }}</p>
          <p class="tabular mt-0.5 select-all font-mono text-sm text-accent">
            {{ group.members[recipient]?.payment?.bankAccount }}
          </p>
        </template>
        <p v-else class="mt-1.5 text-xs text-faint">{{ t('settle.noPaymentInfo') }}</p>
      </div>
    </section>

    <p v-if="error" class="mt-4 text-center text-xs text-negative">{{ error }}</p>
    <p v-if="entry" class="mt-4 text-center text-[11px] text-faint">{{ t('group.rateLocked') }}</p>

    <template #footer>
      <div class="grid grid-cols-2 gap-3">
        <AppButton variant="secondary" @click="emit('close')">{{ t('common.cancel') }}</AppButton>
        <AppButton @click="submit">{{ t('common.save') }}</AppButton>
      </div>
    </template>

    <CurrencyPicker
      :open="pickerOpen"
      :title="t('common.currency')"
      :selected="currency"
      @close="pickerOpen = false"
      @select="currency = $event; pickerOpen = false"
    />
  </AppSheet>
</template>
