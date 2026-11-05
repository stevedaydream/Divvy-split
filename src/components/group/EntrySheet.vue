<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppSheet from '@/components/ui/AppSheet.vue'
import AmountInput from '@/components/currency/AmountInput.vue'
import CurrencyPicker from '@/components/currency/CurrencyPicker.vue'
import ExpenseItemEditor from '@/components/group/ExpenseItemEditor.vue'
import { expensePayments, validExpenseItems, type ExpenseItemInput } from '@/lib/expenseItems'
import { expenseShares } from '@/lib/settlement'
import { CATEGORIES, guessCategory } from '@/data/categories'
import { addDays, todayIso } from '@/lib/dates'
import { lineProfileUrl } from '@/lib/line'
import { convertMinor, formatNumber, toMajor, toMinor } from '@/lib/money'
import { useRatesStore } from '@/stores/rates'
import { useToast } from '@/composables/useToast'
import type { EntryDraft } from '@/services/entries'
import type { CurrencyCode } from '@/types/currency'
import type { Entry, EntryCategory, EntryType, Group, SettlementMethod } from '@/types/models'

/** LINE Pay Money only moves New Taiwan Dollars. */
const LINE_PAY_CURRENCY: CurrencyCode = 'TWD'

const props = defineProps<{
  open: boolean
  group: Group
  uid: string
  /** Set when editing; null when adding. */
  entry: Entry | null
  /** Pre-selects the settlement tab and recipient from a settlement plan. */
  presetSettlement: { to: string; amountMinor: number } | null
  /** Pre-fills a new expense, e.g. from an itinerary item's "record" shortcut. */
  presetExpense?: { title: string; date: string; category: EntryCategory } | null
  locale: string
  saving?: boolean
}>()

const emit = defineEmits<{ close: []; save: [draft: EntryDraft] }>()

const { t } = useI18n()
const rates = useRatesStore()
const toast = useToast()

/**
 * How the user thinks about the record. All four map onto payer + participants:
 * split   — I paid, shared with the picked people (may include me)
 * paidFor — I paid, only the picked others share it
 * owe     — someone else paid, it is all mine
 * repay   — a settlement from me to someone
 */
type EntryMode = 'split' | 'paidFor' | 'owe' | 'repay'
const mode = ref<EntryMode>('split')
const tab = computed<EntryType>(() => (mode.value === 'repay' ? 'settlement' : 'expense'))
const creditor = ref<string | null>(null)
const title = ref('')
const amount = ref('')
const currency = ref<CurrencyCode>(props.group.currency)
const participants = ref<string[]>([])
const recipient = ref<string | null>(null)
const category = ref<EntryCategory>('other')
const note = ref('')
const date = ref(todayIso())
const pickerOpen = ref(false)
const error = ref('')
const itemized = ref(false)
const itemInputs = ref<ExpenseItemInput[]>([])
const allowTotalChange = ref(false)
const payer = ref(props.uid)
const draftItems = computed(() => itemInputs.value.map((item) => ({ title: item.title.trim(), amountMinor: toMinor(Number(item.amount), currency.value), payerId: item.payerId, participantIds: [...item.participantIds] })))
const itemsTotal = computed(() => draftItems.value.reduce((sum, item) => sum + item.amountMinor, 0))

watch([itemsTotal, itemized, tab, currency], () => {
  if (itemized.value && tab.value === 'expense') amount.value = String(toMajor(itemsTotal.value, currency.value))
})

function enableItems(): void {
  itemInputs.value = [{ key: 0, title: title.value, amount: amount.value, payerId: payer.value, participantIds: [...participants.value] }]
  itemized.value = true
}

/** Once the user picks a category, typing the title stops re-guessing it. */
const categoryTouched = ref(false)

watch(title, (next) => {
  if (!categoryTouched.value) category.value = guessCategory(next) ?? 'other'
})

function pickCategory(code: EntryCategory): void {
  category.value = code
  categoryTouched.value = true
}

const today = computed(() => todayIso())
const yesterday = computed(() => addDays(today.value, -1))

/**
 * Editing reuses the entry's stored rate, so re-saving an old entry without
 * touching the amount leaves the converted figure exactly where it was.
 * A new amount or currency re-prices at today's rate.
 */
const originalRate = ref<number | null>(null)

/**
 * Pins the group-currency figure to an exact amount while `currency` and the
 * typed amount still match. Set by a confirmed LINE Pay conversion, so paying
 * a rounded NT$ figure still clears exactly the debt it was converted from
 * instead of leaving a few units of residue.
 */
const pinned = ref<{ currency: CurrencyCode; minor: number; groupMinor: number } | null>(null)
const method = ref<SettlementMethod | null>(null)
const previewOpen = ref(false)

const others = computed(() => props.group.memberIds.filter((uid) => uid !== props.uid))

const modeOptions = computed<EntryMode[]>(() => {
  if (props.entry?.type === 'settlement') return []
  if (props.group.memberIds.length < 2) return []
  return props.entry ? ['split', 'paidFor', 'owe'] : ['split', 'paidFor', 'owe', 'repay']
})

function setMode(next: EntryMode): void {
  if (mode.value === next) return
  mode.value = next
  error.value = ''
  payer.value = props.uid
  if (next === 'split') participants.value = [props.uid]
  if (next === 'paidFor') participants.value = participants.value.filter((id) => id !== props.uid)
}

const modeHint = computed(() => {
  if (mode.value === 'split' && payer.value !== props.uid) {
    return t('entryMode.splitOtherHint', { name: props.group.members[payer.value]?.nickname ?? '' })
  }
  return t(`entryMode.${mode.value}Hint`)
})

/** Per-person preview for the paid-for and owe modes. */
const modeSummary = computed(() => {
  const total = convertedMinor.value
  if (total <= 0) return ''
  const currencyCode = props.group.currency
  if (mode.value === 'owe' && creditor.value) {
    return t('entryMode.oweSummary', {
      name: props.group.members[creditor.value]?.nickname ?? '',
      amount: formatNumber(total, currencyCode, props.locale),
      currency: currencyCode,
    })
  }
  if (mode.value === 'paidFor' && participants.value.length) {
    const shares = expenseShares(
      { payerId: props.uid, participantIds: participants.value, groupAmountMinor: total },
      new Set(props.group.memberIds),
    )
    const most = Math.max(...participants.value.map((id) => shares[id] ?? 0))
    return t(participants.value.length > 1 ? 'entryMode.paidForEach' : 'entryMode.paidForOne', {
      names: participants.value.map((id) => props.group.members[id]?.nickname ?? '').join('、'),
      amount: formatNumber(most, currencyCode, props.locale),
      currency: currencyCode,
    })
  }
  return ''
})

const liveRate = computed(() => rates.rate(currency.value, props.group.currency))

const activePin = computed(() => {
  const pin = pinned.value
  if (!pin || pin.currency !== currency.value) return null
  return pin.minor === toMinor(amount.value, currency.value) ? pin : null
})

const effectiveRate = computed(() => {
  if (currency.value === props.group.currency) return 1
  const pin = activePin.value
  if (pin) return toMajor(pin.groupMinor, props.group.currency) / toMajor(pin.minor, pin.currency)
  const entry = props.entry
  const unchanged =
    entry &&
    originalRate.value !== null &&
    entry.currency === currency.value &&
    entry.amountMinor === toMinor(amount.value, currency.value)
  return unchanged ? originalRate.value! : liveRate.value
})

const convertedMinor = computed(() =>
  activePin.value?.groupMinor ??
  convertMinor(toMinor(amount.value, currency.value), currency.value, props.group.currency, effectiveRate.value),
)

const itemSummary = computed(() => {
  if (!itemized.value || !validExpenseItems(draftItems.value, itemsTotal.value, props.group.memberIds)) return []
  const entry = { items: draftItems.value, payerId: payer.value, participantIds: participants.value, groupAmountMinor: convertedMinor.value }
  const shares = expenseShares(entry, new Set(props.group.memberIds))
  const paid = expensePayments(entry)
  return props.group.memberIds.filter((uid) => shares[uid] || paid[uid]).map((uid) => ({ uid, share: shares[uid] ?? 0, paid: paid[uid] ?? 0 }))
})

const recipientLineId = computed(() => {
  if (!recipient.value) return ''
  return props.group.members[recipient.value]?.payment?.lineId?.trim() ?? ''
})

/** What the current amount would be in NT$, at today's rate. */
const twdPreview = computed(() => {
  const sourceMinor = toMinor(amount.value, currency.value)
  const rate = rates.rate(currency.value, LINE_PAY_CURRENCY)
  if (sourceMinor <= 0 || !rate) return null
  // LINE Pay Money transfers whole dollars only.
  const twdMinor = toMinor(Math.round(toMajor(sourceMinor, currency.value) * rate), LINE_PAY_CURRENCY)
  return { sourceMinor, rate, twdMinor }
})

const rateTime = computed(() =>
  rates.fetchedAt
    ? new Date(rates.fetchedAt).toLocaleTimeString(props.locale, { hour: '2-digit', minute: '2-digit' })
    : '',
)

function formatTwd(minor: number): string {
  return new Intl.NumberFormat(props.locale, { maximumFractionDigits: 0 }).format(
    toMajor(minor, LINE_PAY_CURRENCY),
  )
}

function openPreview(): void {
  void rates.load()
  previewOpen.value = true
}

function confirmConversion(): void {
  const preview = twdPreview.value
  if (!preview) return
  pinned.value = {
    currency: LINE_PAY_CURRENCY,
    minor: preview.twdMinor,
    groupMinor: convertedMinor.value,
  }
  currency.value = LINE_PAY_CURRENCY
  amount.value = String(toMajor(preview.twdMinor, LINE_PAY_CURRENCY))
  previewOpen.value = false
}

/**
 * Copies the amount and opens the recipient's LINE profile. Both calls stay
 * synchronous inside the click so mobile browsers keep the user gesture.
 */
function payWithLine(): void {
  const minor = toMinor(amount.value, currency.value)
  const text = String(Math.round(toMajor(minor, LINE_PAY_CURRENCY)))
  navigator.clipboard?.writeText(text).then(
    () => toast.success(t('line.copied', { amount: formatTwd(minor) })),
    () => toast.info(t('line.copyFailed', { amount: formatTwd(minor) }), 8000),
  )
  method.value = 'linepay'
  window.open(lineProfileUrl(recipientLineId.value), '_blank', 'noopener')
}

const showConversion = computed(() => currency.value !== props.group.currency && amount.value !== '')

watch(
  () => props.open,
  (open) => {
    if (!open) return
    error.value = ''
    pickerOpen.value = false
    previewOpen.value = false
    pinned.value = null
    method.value = props.entry?.method ?? null
    allowTotalChange.value = false
    itemized.value = false
    itemInputs.value = []
    payer.value = props.entry?.payerId ?? props.uid
    creditor.value = null

    const entry = props.entry
    if (entry) {
      const ids = entry.participantIds
      if (entry.type === 'settlement') mode.value = 'repay'
      else if (entry.items?.length) mode.value = 'split'
      else if (entry.payerId !== props.uid && ids.length === 1 && ids[0] === props.uid) {
        mode.value = 'owe'
        creditor.value = entry.payerId
        payer.value = props.uid
      } else if (entry.payerId === props.uid && !ids.includes(props.uid)) mode.value = 'paidFor'
      else mode.value = 'split'
      categoryTouched.value = true
      category.value = entry.category
      note.value = entry.note
      date.value = entry.date
      title.value = entry.title
      amount.value = String(toMajor(entry.amountMinor, entry.currency))
      currency.value = entry.currency
      participants.value = entry.type === 'expense' ? [...entry.participantIds] : []
      recipient.value = entry.type === 'settlement' ? (entry.participantIds[0] ?? null) : null
      originalRate.value = entry.rate
      itemInputs.value = (entry.items ?? []).map((item, index) => ({ key: index, title: item.title, amount: String(toMajor(item.amountMinor, entry.currency)), payerId: item.payerId, participantIds: [...item.participantIds] }))
      itemized.value = !!entry.items?.length
      return
    }

    originalRate.value = null
    currency.value = props.group.currency
    title.value = ''
    categoryTouched.value = false
    category.value = 'other'
    note.value = ''
    date.value = todayIso()

    const preset = props.presetSettlement
    if (preset) {
      mode.value = 'repay'
      recipient.value = preset.to
      amount.value = String(toMajor(preset.amountMinor, props.group.currency))
      participants.value = []
    } else {
      mode.value = 'split'
      recipient.value = null
      amount.value = ''
      participants.value = [props.uid]

      const expense = props.presetExpense
      if (expense) {
        // The preset's category wins over the title guess.
        categoryTouched.value = true
        category.value = expense.category
        title.value = expense.title
        date.value = expense.date
      }
    }
  },
)

function toggleParticipant(uid: string): void {
  participants.value = participants.value.includes(uid)
    ? participants.value.filter((id) => id !== uid)
    : [...participants.value, uid]
}

function toggleAll(): void {
  const pool = mode.value === 'paidFor' ? others.value : props.group.memberIds
  participants.value = participants.value.length === pool.length ? [] : [...pool]
}

const justMe = computed(() => participants.value.length === 1 && participants.value[0] === props.uid)

function submit(): void {
  if (props.saving) return
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
  if (mode.value === 'owe' && !creditor.value) {
    error.value = t('entryMode.pickCreditor')
    return
  }
  if (!isSettlement && mode.value !== 'owe' && !itemized.value && participants.value.length === 0) {
    error.value = t('group.splitNobody')
    return
  }
  if (!isSettlement && itemized.value) {
    if (!validExpenseItems(draftItems.value, amountMinor, props.group.memberIds)) {
      error.value = t('itemized.invalid')
      return
    }
    if (props.entry && (amountMinor !== props.entry.amountMinor || currency.value !== props.entry.currency) && !allowTotalChange.value) {
      error.value = t('itemized.confirmTotal')
      return
    }
  }
  if (currency.value !== props.group.currency && (!effectiveRate.value || effectiveRate.value <= 0)) {
    error.value = t('currency.unavailable')
    return
  }
  if (!date.value) {
    error.value = t('group.dateRequired')
    return
  }

  error.value = ''
  const entryCategory: EntryCategory = isSettlement ? 'other' : category.value

  emit('save', {
    groupId: props.group.id,
    type: tab.value,
    title: isSettlement ? t('group.settlement') : title.value.trim() || t('group.expense'),
    payerId: mode.value === 'owe' ? creditor.value! : payer.value,
    participantIds: isSettlement
      ? [recipient.value!]
      : mode.value === 'owe'
        ? [props.uid]
        : itemized.value
          ? [...new Set(draftItems.value.flatMap((item) => item.participantIds))]
          : [...participants.value],
    items: !isSettlement && itemized.value ? draftItems.value : [],
    amountMinor,
    currency: currency.value,
    rate: effectiveRate.value,
    groupAmountMinor: convertedMinor.value,
    method: isSettlement ? method.value : null,
    category: entryCategory,
    note: !isSettlement && entryCategory === 'other' ? note.value.trim().slice(0, 200) : '',
    date: date.value,
  })
}
</script>

<template>
  <AppSheet
    :open="open"
    :title="entry ? t('common.edit') : t('group.addExpense')"
    @close="emit('close')"
  >
    <div v-if="modeOptions.length && !itemized" class="mb-6">
      <div class="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1" role="radiogroup" :aria-label="t('entryMode.label')">
        <button
          v-for="option in modeOptions"
          :key="option"
          type="button"
          role="radio"
          :aria-checked="mode === option"
          class="rounded-lg px-2 py-2 text-sm font-medium transition-colors"
          :class="mode === option ? 'bg-surface text-fg shadow-card' : 'text-muted'"
          @click="setMode(option)"
        >
          {{ t(`entryMode.${option}`) }}
        </button>
      </div>
      <p class="mt-2 text-center text-xs text-muted">{{ modeHint }}</p>
    </div>

    <AmountInput
      v-if="!itemized || tab !== 'expense'"
      v-model="amount"
      :currency="currency"
      @pick-currency="pickerOpen = true"
    />
    <div v-else class="text-center">
      <p class="text-xs text-muted">{{ t('itemized.total') }}</p>
      <p class="tabular mt-1 text-3xl font-semibold">{{ formatNumber(itemsTotal, currency, locale) }}</p>
      <button type="button" class="mt-1 text-sm text-accent" @click="pickerOpen = true">{{ currency }}</button>
    </div>

    <p v-if="showConversion" class="mt-2 text-center text-xs text-muted">
      {{ t('group.converts', {
        amount: formatNumber(convertedMinor, group.currency, locale),
        currency: group.currency,
      }) }}
    </p>

    <section class="mt-6 flex items-center gap-2">
      <label for="entry-date" class="text-xs font-medium text-muted">{{ t('group.date') }}</label>
      <input
        id="entry-date"
        v-model="date"
        type="date"
        required
        class="tabular h-9 min-w-0 flex-1 rounded-lg border border-border bg-surface px-2.5 text-sm focus:border-accent focus:outline-none"
      />
      <button
        v-for="option in [{ value: today, label: t('group.today') }, { value: yesterday, label: t('group.yesterday') }]"
        :key="option.value"
        type="button"
        class="h-9 shrink-0 rounded-lg border px-2.5 text-xs font-medium transition-colors"
        :class="date === option.value ? 'border-accent bg-accent-soft text-accent' : 'border-border text-muted'"
        @click="date = option.value"
      >
        {{ option.label }}
      </button>
    </section>

    <div v-if="tab === 'expense'" class="mt-6 space-y-6">
      <AppInput v-model="title" :placeholder="t('group.whatPlaceholder')" />
      <AppButton v-if="!itemized && mode === 'split'" variant="secondary" block @click="enableItems">{{ t('itemized.enable') }}</AppButton>
      <template v-else>
        <ExpenseItemEditor v-model="itemInputs" :group="group" :uid="uid" />
        <section v-if="itemSummary.length" class="rounded-xl border border-border p-3">
          <h3 class="mb-2 text-xs font-medium text-muted">{{ t('itemized.summary') }} · {{ group.currency }}</h3>
          <div v-for="person in itemSummary" :key="person.uid" class="flex justify-between gap-3 py-1 text-xs">
            <span>{{ group.members[person.uid]?.nickname }}</span>
            <span class="tabular text-muted">{{ t('itemized.personSummary', { share: formatNumber(person.share, group.currency, locale), paid: formatNumber(person.paid, group.currency, locale) }) }}</span>
          </div>
        </section>
        <label v-if="entry && (toMinor(amount, currency) !== entry.amountMinor || currency !== entry.currency)" class="flex items-start gap-2 text-xs text-muted">
          <input v-model="allowTotalChange" type="checkbox" class="mt-0.5 accent-accent" />{{ t('itemized.confirmTotal') }}
        </label>
      </template>

      <section>
        <h3 class="mb-2 text-xs font-medium text-muted">{{ t('group.category') }}</h3>
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="item in CATEGORIES"
            :key="item.code"
            type="button"
            class="flex h-10 items-center justify-center gap-1.5 rounded-lg border text-sm transition-colors"
            :class="
              category === item.code
                ? 'border-accent bg-accent-soft font-medium text-accent'
                : 'border-border text-muted'
            "
            :aria-pressed="category === item.code"
            @click="pickCategory(item.code)"
          >
            <span aria-hidden="true">{{ item.emoji }}</span>
            {{ t(`category.${item.code}`) }}
          </button>
        </div>
        <AppInput
          v-if="category === 'other'"
          v-model="note"
          class="mt-2"
          :placeholder="t('group.notePlaceholder')"
        />
      </section>

      <section v-if="group.memberIds.length > 1 && !itemized && mode === 'owe'">
        <h3 class="mb-2 text-xs font-medium text-muted">{{ t('entryMode.oweWho') }}</h3>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="uid in others"
            :key="uid"
            type="button"
            class="rounded-lg border px-3 py-1.5 text-sm transition-colors"
            :class="creditor === uid ? 'border-accent bg-accent-soft text-accent' : 'border-border text-muted'"
            :aria-pressed="creditor === uid"
            @click="creditor = uid"
          >
            {{ group.members[uid]?.nickname }}
          </button>
        </div>
        <p v-if="modeSummary" class="mt-3 text-xs text-accent">{{ modeSummary }}</p>
      </section>

      <section v-if="group.memberIds.length > 1 && !itemized && mode === 'split'">
        <h3 class="mb-2 text-xs font-medium text-muted">{{ t('entryMode.whoPaid') }}</h3>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="id in group.memberIds"
            :key="id"
            type="button"
            class="rounded-lg border px-3 py-1.5 text-sm transition-colors"
            :class="payer === id ? 'border-accent bg-accent-soft text-accent' : 'border-border text-muted'"
            :aria-pressed="payer === id"
            @click="payer = id"
          >
            {{ id === uid ? t('entryMode.me') : group.members[id]?.nickname }}
          </button>
        </div>
      </section>

      <section v-if="group.memberIds.length > 1 && !itemized && mode !== 'owe'">
        <div class="mb-2 flex items-center justify-between">
          <h3 class="text-xs font-medium text-muted">
            {{ mode === 'paidFor' ? t('entryMode.paidForWho') : t('group.splitWith') }}
          </h3>
          <div class="flex gap-3">
            <button
              v-if="mode === 'split'"
              class="text-xs font-medium"
              :class="justMe ? 'text-fg' : 'text-accent'"
              @click="participants = [uid]"
            >
              {{ t('group.justMe') }}
            </button>
            <button class="text-xs font-medium text-accent" @click="toggleAll">
              {{ t('group.splitAll') }}
            </button>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            v-for="uid in mode === 'paidFor' ? others : group.memberIds"
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
        <p v-if="modeSummary" class="mt-3 text-xs text-accent">{{ modeSummary }}</p>
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

      <div v-if="recipientLineId" class="mt-3 rounded-card border border-border bg-surface-2 p-4">
        <h4 class="text-xs font-medium text-muted">LINE Pay</h4>

        <template v-if="currency !== LINE_PAY_CURRENCY">
          <p class="mt-1.5 text-xs leading-relaxed text-muted">{{ t('line.needsTwd') }}</p>

          <div v-if="previewOpen" class="mt-3 rounded-xl border border-border bg-surface p-3">
            <template v-if="twdPreview">
              <p class="tabular text-sm">
                {{ currency }} {{ formatNumber(twdPreview.sourceMinor, currency, locale) }}
                → <span class="font-semibold text-accent">NT$ {{ formatTwd(twdPreview.twdMinor) }}</span>
              </p>
              <p class="tabular mt-1 text-[11px] text-faint">
                1 {{ currency }} = {{ twdPreview.rate.toFixed(4) }} TWD · {{ t('line.rateAt', { time: rateTime }) }}
              </p>
              <div class="mt-3 grid grid-cols-2 gap-2">
                <AppButton variant="secondary" size="sm" @click="previewOpen = false">
                  {{ t('common.cancel') }}
                </AppButton>
                <AppButton size="sm" @click="confirmConversion">{{ t('line.confirmConvert') }}</AppButton>
              </div>
            </template>
            <p v-else class="text-xs text-negative">
              {{ rates.loading ? t('common.loading') : t('currency.unavailable') }}
            </p>
          </div>

          <div v-else class="mt-3">
            <AppButton variant="secondary" size="sm" block @click="openPreview">
              {{ t('line.convert') }}
            </AppButton>
          </div>
        </template>

        <template v-else>
          <p v-if="activePin" class="tabular mt-1.5 text-[11px] text-faint">
            {{ t('line.convertedFrom', {
              amount: formatNumber(activePin.groupMinor, group.currency, locale),
              currency: group.currency,
            }) }}
          </p>
          <div class="mt-3">
            <AppButton block @click="payWithLine">
              {{ t('line.pay', { amount: formatTwd(toMinor(amount, currency)) }) }}
            </AppButton>
          </div>
          <p class="mt-2 text-[11px] leading-relaxed text-faint">{{ t('line.steps') }}</p>
        </template>
      </div>
    </section>

    <p v-if="error" class="mt-4 text-center text-xs text-negative">{{ error }}</p>
    <p v-if="entry" class="mt-4 text-center text-[11px] text-faint">{{ t('group.rateLocked') }}</p>

    <template #footer>
      <div class="grid grid-cols-2 gap-3">
        <AppButton variant="secondary" @click="emit('close')">{{ t('common.cancel') }}</AppButton>
        <AppButton :loading="saving" @click="submit">{{ t('common.save') }}</AppButton>
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
