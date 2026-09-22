<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { BarChart3, ChartLine, ChartPie, TrendingUp } from 'lucide-vue-next'
import AppEmptyState from '@/components/ui/AppEmptyState.vue'
import ChartCanvas, { type ChartSeries } from '@/components/charts/ChartCanvas.vue'
import { categoryColor, categoryEmoji } from '@/data/categories'
import { useTheme } from '@/composables/useTheme'
import { formatShortDay } from '@/lib/dates'
import { estimatesByDay, hasTripDates, totalEstimate } from '@/lib/itinerary'
import { decimalsOf, formatNumber, toMajor } from '@/lib/money'
import { byCategory, byDay, cumulative, spendItems, sumItems } from '@/lib/stats'
import type { Entry, Group, ItineraryItem } from '@/types/models'

const props = defineProps<{
  group: Group
  entries: Entry[]
  /** Planned costs; compared against actual spending day by day. */
  itinerary: ItineraryItem[]
  uid: string
  locale: string
}>()

const { t } = useI18n()

type CategoryChart = 'bar' | 'doughnut'
type DayChart = 'line' | 'bar' | 'cumulative'

const PREFS_KEY = 'divvy:stats-charts'

function readPrefs(): { category: CategoryChart; day: DayChart } {
  try {
    const parsed = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Record<string, string>
    return {
      category: parsed.category === 'doughnut' ? 'doughnut' : 'bar',
      day: parsed.day === 'bar' || parsed.day === 'cumulative' ? parsed.day : 'line',
    }
  } catch {
    return { category: 'bar', day: 'line' }
  }
}

const prefs = readPrefs()
const categoryChart = ref<CategoryChart>(prefs.category)
const dayChart = ref<DayChart>(prefs.day)

watch([categoryChart, dayChart], ([category, day]) => {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ category, day }))
  } catch { /* the choice lasts for this session only */ }
})

const shared = computed(() => props.group.memberIds.length > 1)
const scope = ref<'all' | 'mine'>('all')

const items = computed(() =>
  spendItems(props.entries, props.group.memberIds, shared.value && scope.value === 'mine' ? props.uid : null),
)
const total = computed(() => sumItems(items.value))
const categories = computed(() => byCategory(items.value))
/**
 * Estimates are group-level, so they are only compared with everyone's
 * spending — splitting a plan per person would be guesswork.
 */
const showEstimates = computed(() => !(shared.value && scope.value === 'mine') && totalEstimate(props.itinerary) > 0)
const estimates = computed(() => estimatesByDay(props.itinerary))

/** The trip's dates, stretched to cover any spending or plans outside them. */
const range = computed(() => {
  const dates = [...items.value.map((i) => i.date), ...(showEstimates.value ? estimates.value.keys() : [])]
  if (hasTripDates(props.group.startDate, props.group.endDate)) dates.push(props.group.startDate, props.group.endDate)
  if (!dates.length) return undefined
  dates.sort()
  return { from: dates[0]!, to: dates[dates.length - 1]! }
})

const days = computed(() => byDay(items.value, range.value))
const estimateTotal = computed(() => totalEstimate(props.itinerary))
/** Actual against plan, e.g. +15 when 15% over. */
const overPercent = computed(() =>
  estimateTotal.value ? Math.round(((total.value - estimateTotal.value) / estimateTotal.value) * 100) : 0,
)
const activeDays = computed(() => days.value.filter((d) => d.amountMinor !== 0).length)

const currency = computed(() => props.group.currency)
const money = (minor: number) => formatNumber(minor, currency.value, props.locale)

// Charts plot major units; the formatter keeps the currency's own decimals.
const chartFormat = computed(() => {
  const formatter = new Intl.NumberFormat(props.locale, { maximumFractionDigits: decimalsOf(currency.value) })
  return (value: number) => formatter.format(value)
})

const categorySeries = computed<ChartSeries[]>(() => [
  {
    label: t('stats.byCategory'),
    data: categories.value.map((c) => toMajor(c.amountMinor, currency.value)),
    color: categories.value.map((c) => categoryColor(c.category)),
  },
])
const categoryLabels = computed(() => categories.value.map((c) => t(`category.${c.category}`)))

// Series colours come from the theme tokens; reading `theme` makes them
// recompute when the user switches between light and dark.
const { theme } = useTheme()
function token(name: string, fallback: string): string {
  void theme.value
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}
const muted = computed(() => token('--c-faint', '#a1a1aa'))
const accent = computed(() => token('--c-accent', '#0d9488'))

const daySeries = computed<ChartSeries[]>(() => {
  const shape = (values: number[]) => (dayChart.value === 'cumulative' ? cumulative(values) : values)
  const series: ChartSeries[] = [
    {
      label: t('stats.actual'),
      data: shape(days.value.map((d) => toMajor(d.amountMinor, currency.value))),
      color: accent.value,
    },
  ]
  if (showEstimates.value) {
    series.push({
      label: t('stats.estimated'),
      data: shape(days.value.map((d) => toMajor(estimates.value.get(d.date) ?? 0, currency.value))),
      color: muted.value,
      dashed: true,
    })
  }
  return series
})
const dayLabels = computed(() => days.value.map((d) => formatShortDay(d.date)))

const CATEGORY_CHARTS = [
  { value: 'bar', icon: BarChart3, label: 'stats.chartBar' },
  { value: 'doughnut', icon: ChartPie, label: 'stats.chartDoughnut' },
] as const

const DAY_CHARTS = [
  { value: 'line', icon: ChartLine, label: 'stats.chartLine' },
  { value: 'bar', icon: BarChart3, label: 'stats.chartBar' },
  { value: 'cumulative', icon: TrendingUp, label: 'stats.chartCumulative' },
] as const
</script>

<template>
  <div class="space-y-4 px-5 pb-28 pt-5">
    <div v-if="shared" class="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1">
      <button
        v-for="option in (['all', 'mine'] as const)"
        :key="option"
        class="rounded-lg py-2 text-sm font-medium transition-colors"
        :class="scope === option ? 'bg-surface text-fg shadow-card' : 'text-muted'"
        :aria-pressed="scope === option"
        @click="scope = option"
      >
        {{ t(`stats.scope.${option}`) }}
      </button>
    </div>

    <AppEmptyState
      v-if="!items.length"
      :icon="BarChart3"
      :title="t('stats.empty')"
      :description="t('stats.emptyHint')"
    />

    <template v-else>
      <section class="rounded-card border border-border bg-surface p-5 shadow-card">
        <p class="text-xs font-medium text-muted">
          {{ shared && scope === 'mine' ? t('stats.myTotal') : t('stats.total') }}
        </p>
        <p class="tabular mt-1 text-2xl font-semibold tracking-tight">
          {{ money(total) }} <span class="text-sm font-normal text-muted">{{ currency }}</span>
        </p>
        <p v-if="showEstimates" class="tabular mt-1 text-xs text-muted">
          {{ t('stats.vsEstimate', { amount: money(estimateTotal) }) }}
          <span :class="overPercent > 0 ? 'text-negative' : 'text-positive'">
            ({{ overPercent > 0 ? '+' : '' }}{{ overPercent }}%)
          </span>
        </p>
        <p v-if="activeDays > 1" class="tabular mt-1 text-xs text-faint">
          {{ t('stats.dailyAverage', { amount: money(Math.round(total / days.length)), days: days.length }) }}
        </p>
      </section>

      <section class="rounded-card border border-border bg-surface p-5 shadow-card">
        <header class="mb-4 flex items-center justify-between">
          <h2 class="text-sm font-semibold">{{ t('stats.byCategory') }}</h2>
          <div class="flex gap-1" role="group" :aria-label="t('stats.chartType')">
            <button
              v-for="option in CATEGORY_CHARTS"
              :key="option.value"
              class="grid size-8 place-items-center rounded-lg transition-colors"
              :class="categoryChart === option.value ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-2'"
              :aria-label="t(option.label)"
              :aria-pressed="categoryChart === option.value"
              @click="categoryChart = option.value"
            >
              <component :is="option.icon" class="size-4" />
            </button>
          </div>
        </header>

        <ChartCanvas
          :kind="categoryChart"
          :labels="categoryLabels"
          :series="categorySeries"
          :format="chartFormat"
          :horizontal="categoryChart === 'bar'"
          :height="categoryChart === 'bar' ? Math.max(120, categories.length * 40) : 200"
        />

        <ul class="mt-4 space-y-2">
          <li v-for="item in categories" :key="item.category" class="flex items-center gap-2 text-sm">
            <span class="size-2.5 shrink-0 rounded-full" :style="{ background: categoryColor(item.category) }" />
            <span aria-hidden="true">{{ categoryEmoji(item.category) }}</span>
            <span class="flex-1 truncate">{{ t(`category.${item.category}`) }}</span>
            <span class="tabular font-medium">{{ money(item.amountMinor) }}</span>
            <span class="tabular w-11 text-right text-xs text-muted">{{ Math.round(item.ratio * 100) }}%</span>
          </li>
        </ul>
      </section>

      <section class="rounded-card border border-border bg-surface p-5 shadow-card">
        <header class="mb-4 flex items-center justify-between">
          <h2 class="text-sm font-semibold">{{ t('stats.byDay') }}</h2>
          <div class="flex gap-1" role="group" :aria-label="t('stats.chartType')">
            <button
              v-for="option in DAY_CHARTS"
              :key="option.value"
              class="grid size-8 place-items-center rounded-lg transition-colors"
              :class="dayChart === option.value ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-2'"
              :aria-label="t(option.label)"
              :aria-pressed="dayChart === option.value"
              @click="dayChart = option.value"
            >
              <component :is="option.icon" class="size-4" />
            </button>
          </div>
        </header>

        <ChartCanvas
          :kind="dayChart === 'bar' ? 'bar' : 'line'"
          :labels="dayLabels"
          :series="daySeries"
          :format="chartFormat"
        />
      </section>
    </template>
  </div>
</template>
