<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowUpDown, Delete, History, MapPin, Plus, RefreshCw, X } from 'lucide-vue-next'
import AppShell from '@/components/layout/AppShell.vue'
import TopBar from '@/components/layout/TopBar.vue'
import AppSheet from '@/components/ui/AppSheet.vue'
import CurrencyPicker from '@/components/currency/CurrencyPicker.vue'
import { currencyForCountry, currencyName } from '@/data/currencies'
import { evaluate } from '@/lib/calc'
import { detectLocation } from '@/lib/geo'
import { useRatesStore } from '@/stores/rates'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import type { CurrencyCode } from '@/types/currency'

const { t, locale } = useI18n()
const rates = useRatesStore()
const auth = useAuthStore()
const toast = useToast()

const BASE_KEY = 'divvy:calc-base'
const TARGETS_KEY = 'divvy:calc-targets'
const HISTORY_KEY = 'divvy:calc-history'

interface HistoryItem {
  expression: string
  result: number
  currency: CurrencyCode
}

function restore<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function persist(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch { /* storage unavailable */ }
}

const base = ref<CurrencyCode>(restore(BASE_KEY, auth.profile?.currency ?? 'TWD'))
const targets = ref<CurrencyCode[]>(restore(TARGETS_KEY, ['USD', 'JPY', 'EUR', 'KRW']))
const history = ref<HistoryItem[]>(restore(HISTORY_KEY, []))

const expression = ref('')
const entry = ref('')
const error = ref(false)

const pickerMode = ref<'base' | 'add' | null>(null)
const historyOpen = ref(false)
const locating = ref(false)

const home = computed(() => auth.profile?.currency ?? null)

watch(base, (value) => persist(BASE_KEY, value))
watch(targets, (value) => persist(TARGETS_KEY, value), { deep: true })
watch(history, (value) => persist(HISTORY_KEY, value.slice(0, 40)), { deep: true })

/** Keeps the home currency at the top of the list unless it is the base. */
watch(
  [base, home],
  ([currentBase, homeCode]) => {
    if (!homeCode || homeCode === currentBase || targets.value[0] === homeCode) return
    targets.value = [homeCode, ...targets.value.filter((c) => c !== homeCode)]
  },
  { immediate: true },
)

onMounted(() => {
  void rates.load()
})

const amount = computed(() => {
  if (error.value) return 0
  const combined = expression.value + entry.value
  if (!combined) return 0
  return evaluate(combined) ?? Number.parseFloat(entry.value) ?? 0
})

const display = computed(() => (error.value ? '—' : entry.value || '0'))

function convert(target: CurrencyCode): string {
  const rate = rates.rate(base.value, target)
  if (!rate) return '—'
  return new Intl.NumberFormat(locale.value, { maximumFractionDigits: 2 }).format(amount.value * rate)
}

function appendDigit(digit: string): void {
  error.value = false
  if (digit === '.' && entry.value.includes('.')) return
  entry.value = entry.value === '0' && digit !== '.' ? digit : entry.value + digit
}

function appendOperator(operator: string): void {
  if (!entry.value) return
  error.value = false
  expression.value += `${entry.value} ${operator} `
  entry.value = ''
}

function backspace(): void {
  error.value = false
  if (entry.value) entry.value = entry.value.slice(0, -1)
  else expression.value = expression.value.trimEnd().slice(0, -1).trimEnd()
}

function clearAll(): void {
  expression.value = ''
  entry.value = ''
  error.value = false
}

function calculate(): void {
  const combined = (expression.value + entry.value).trim()
  if (!combined) return

  const result = evaluate(combined)
  if (result === null) {
    error.value = true
    return
  }

  history.value = [
    { expression: combined, result, currency: base.value },
    ...history.value,
  ].slice(0, 40)

  entry.value = String(Number.parseFloat(result.toFixed(4)))
  expression.value = ''
}

function recall(item: HistoryItem): void {
  entry.value = String(item.result)
  expression.value = ''
  error.value = false
  historyOpen.value = false
}

// Moving a currency to the base slot returns the old base to the list,
// so nothing silently disappears.
function setBase(code: CurrencyCode): void {
  if (code === base.value) return
  const previous = base.value
  base.value = code
  targets.value = [previous, ...targets.value.filter((c) => c !== code && c !== previous)]
}

async function locate(): Promise<void> {
  locating.value = true
  try {
    const local = currencyForCountry((await detectLocation()).countryCode)
    if (local) setBase(local)
    else toast.error(t('calculator.locateUnknown'))
  } catch {
    toast.error(t('onboarding.detectFailed'))
  } finally {
    locating.value = false
  }
}

function pickCurrency(code: CurrencyCode): void {
  if (pickerMode.value === 'base') {
    setBase(code)
  } else if (pickerMode.value === 'add' && !targets.value.includes(code)) {
    targets.value = [...targets.value, code]
  }
  pickerMode.value = null
}

function swapToBase(code: CurrencyCode): void {
  const previous = base.value
  base.value = code
  targets.value = targets.value.map((c) => (c === code ? previous : c))
}

function removeTarget(code: CurrencyCode): void {
  targets.value = targets.value.filter((c) => c !== code)
}
</script>

<template>
  <AppShell nav>
    <TopBar :title="t('calculator.title')">
      <template #actions>
        <button
          class="grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          :aria-label="t('calculator.locate')"
          :title="t('calculator.locate')"
          :disabled="locating"
          @click="locate"
        >
          <MapPin class="size-4" :class="locating ? 'animate-pulse' : ''" />
        </button>
        <button
          class="grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          :aria-label="t('currency.refresh')"
          @click="rates.load(true)"
        >
          <RefreshCw class="size-4" :class="rates.loading ? 'animate-spin' : ''" />
        </button>
        <button
          class="grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          :aria-label="t('calculator.history')"
          @click="historyOpen = true"
        >
          <History class="size-4" />
        </button>
      </template>
    </TopBar>

    <section class="px-5 pb-6 pt-5">
      <div class="flex items-end justify-between">
        <button
          class="rounded-lg px-2 py-1 text-left transition-colors hover:bg-surface-2"
          @click="pickerMode = 'base'"
        >
          <span class="block text-xs text-muted">{{ t('currency.base') }}</span>
          <span class="block text-lg font-semibold text-accent">{{ base }}</span>
        </button>
        <p class="tabular truncate pl-4 text-xs text-faint">{{ expression }}</p>
      </div>

      <p class="tabular mt-1 truncate text-right text-5xl font-light tracking-tight">
        {{ display }}
      </p>

      <p v-if="!rates.hasRates && !rates.loading" class="mt-3 text-right text-xs text-negative">
        {{ t('currency.unavailable') }}
      </p>
      <p v-else-if="rates.isStale" class="mt-3 text-right text-xs text-faint">
        {{ t('currency.stale') }}
      </p>
    </section>

    <section class="space-y-2 px-5 pb-6">
      <TransitionGroup name="list" tag="div" class="relative space-y-2">
        <div
          v-for="target in targets"
          :key="target"
          class="flex items-center gap-3 rounded-card border border-border bg-surface p-4 shadow-card"
        >
          <button
            class="flex min-w-0 flex-1 items-center gap-3 text-left"
            :aria-label="t('calculator.swap')"
            @click="swapToBase(target)"
          >
            <span class="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-semibold text-muted">
              {{ target }}
            </span>
            <span class="min-w-0">
              <span class="block truncate text-xs text-muted">{{ currencyName(target) }}</span>
              <span class="tabular block text-lg font-semibold">{{ convert(target) }}</span>
            </span>
          </button>

          <ArrowUpDown class="size-3.5 shrink-0 text-faint" />

          <!-- The home currency is always pinned first, so it cannot be removed. -->
          <button
            class="grid size-8 shrink-0 place-items-center rounded-full text-faint transition-colors hover:bg-negative-soft hover:text-negative"
            :class="target === home ? 'invisible' : ''"
            :disabled="target === home"
            :aria-label="t('calculator.remove')"
            @click="removeTarget(target)"
          >
            <X class="size-3.5" />
          </button>
        </div>
      </TransitionGroup>

      <button
        class="flex w-full items-center justify-center gap-2 rounded-card border border-dashed border-border py-3.5 text-sm text-muted transition-colors hover:border-accent hover:text-accent"
        @click="pickerMode = 'add'"
      >
        <Plus class="size-4" />
        {{ t('calculator.addCurrency') }}
      </button>
    </section>

    <section class="sticky bottom-20 mx-5 mb-4 grid grid-cols-4 gap-2 rounded-sheet border border-border bg-surface p-3 shadow-float">
      <button class="h-12 rounded-xl text-sm font-medium text-negative transition-colors hover:bg-surface-2" @click="clearAll">
        AC
      </button>
      <button class="grid h-12 place-items-center rounded-xl transition-colors hover:bg-surface-2" :aria-label="'Backspace'" @click="backspace">
        <Delete class="size-4" />
      </button>
      <button class="h-12 rounded-xl text-lg text-accent transition-colors hover:bg-accent-soft" @click="appendOperator('/')">÷</button>
      <button class="h-12 rounded-xl text-lg text-accent transition-colors hover:bg-accent-soft" @click="appendOperator('*')">×</button>

      <button v-for="d in ['7', '8', '9']" :key="d" class="h-12 rounded-xl text-lg transition-colors hover:bg-surface-2" @click="appendDigit(d)">{{ d }}</button>
      <button class="h-12 rounded-xl text-lg text-accent transition-colors hover:bg-accent-soft" @click="appendOperator('-')">−</button>

      <button v-for="d in ['4', '5', '6']" :key="d" class="h-12 rounded-xl text-lg transition-colors hover:bg-surface-2" @click="appendDigit(d)">{{ d }}</button>
      <button class="h-12 rounded-xl text-lg text-accent transition-colors hover:bg-accent-soft" @click="appendOperator('+')">+</button>

      <div class="col-span-3 grid grid-cols-3 gap-2">
        <button v-for="d in ['1', '2', '3']" :key="d" class="h-12 rounded-xl text-lg transition-colors hover:bg-surface-2" @click="appendDigit(d)">{{ d }}</button>
        <button class="col-span-2 h-12 rounded-xl text-lg transition-colors hover:bg-surface-2" @click="appendDigit('0')">0</button>
        <button class="h-12 rounded-xl text-lg transition-colors hover:bg-surface-2" @click="appendDigit('.')">.</button>
      </div>

      <button class="row-span-2 h-full rounded-xl bg-accent text-xl text-accent-fg transition-transform active:scale-95" @click="calculate">
        =
      </button>
    </section>

    <AppSheet :open="historyOpen" :title="t('calculator.history')" @close="historyOpen = false">
      <p v-if="!history.length" class="py-12 text-center text-sm text-muted">
        {{ t('calculator.noHistory') }}
      </p>

      <ul v-else class="-mx-2 space-y-1">
        <li v-for="(item, index) in history" :key="index">
          <button
            class="w-full rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-2"
            @click="recall(item)"
          >
            <span class="tabular block truncate font-mono text-xs text-faint">{{ item.expression }}</span>
            <span class="tabular block text-sm font-semibold">
              {{ item.result }}
              <span class="text-xs font-normal text-muted">{{ item.currency }}</span>
            </span>
          </button>
        </li>
      </ul>

      <template v-if="history.length" #footer>
        <button
          class="w-full rounded-xl py-2.5 text-sm font-medium text-negative transition-colors hover:bg-negative-soft"
          @click="history = []"
        >
          {{ t('calculator.clearHistory') }}
        </button>
      </template>
    </AppSheet>

    <CurrencyPicker
      :open="pickerMode !== null"
      :title="pickerMode === 'base' ? t('currency.base') : t('calculator.addCurrency')"
      :selected="pickerMode === 'base' ? base : null"
      :exclude="pickerMode === 'add' ? [base, ...targets] : []"
      @close="pickerMode = null"
      @select="pickCurrency"
    />
  </AppShell>
</template>
