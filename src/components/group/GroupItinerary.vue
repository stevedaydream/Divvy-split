<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { AlertTriangle, BedDouble, CalendarDays, MapPin, Plane, Plus, ReceiptText, Sparkles } from 'lucide-vue-next'
import AppButton from '@/components/ui/AppButton.vue'
import { categoryEmoji } from '@/data/categories'
import { formatDay, todayIso } from '@/lib/dates'
import { hasTripDates, layoutDays, mapsUrl, totalEstimate } from '@/lib/itinerary'
import { formatNumber } from '@/lib/money'
import type { Group, ItineraryItem, ItineraryKind } from '@/types/models'

const props = defineProps<{
  group: Group
  items: ItineraryItem[]
  locale: string
}>()

const emit = defineEmits<{
  add: [date: string, kind: ItineraryKind]
  edit: [item: ItineraryItem]
  record: [item: ItineraryItem]
  setDates: [start: string, end: string]
  ai: []
}>()

const { t } = useI18n()

const hasDates = computed(() => hasTripDates(props.group.startDate, props.group.endDate))
const layout = computed(() => layoutDays(props.items, props.group.startDate, props.group.endDate))
const estimate = computed(() => totalEstimate(props.items))
const today = todayIso()

/** Flights and stays at a glance, above the day-by-day plan. */
const logistics = computed(() =>
  props.items
    .filter((item) => item.kind !== 'spot')
    .sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date < b.date ? -1 : 1)),
)

const money = (minor: number) => formatNumber(minor, props.group.currency, props.locale)

function editorName(item: ItineraryItem): string {
  return props.group.members[item.updatedBy]?.nickname ?? t('common.unknown')
}

const KIND_ICON = { spot: MapPin, flight: Plane, lodging: BedDouble } as const

// Inline trip-date form for groups that have none yet.
const start = ref(today)
const end = ref(today)
const datesError = ref('')

function saveDates(): void {
  if (!hasTripDates(start.value, end.value)) {
    datesError.value = t('itinerary.datesInvalid')
    return
  }
  datesError.value = ''
  emit('setDates', start.value, end.value)
}
</script>

<template>
  <div class="space-y-5 px-5 pb-28 pt-5">
    <section v-if="!hasDates" class="rounded-card border border-border bg-surface p-5 shadow-card">
      <div class="flex items-center gap-2">
        <CalendarDays class="size-4 text-accent" />
        <h2 class="text-sm font-semibold">{{ t('itinerary.setDatesTitle') }}</h2>
      </div>
      <p class="mt-1 text-xs leading-relaxed text-muted">{{ t('itinerary.setDatesHint') }}</p>
      <div class="mt-4 grid grid-cols-2 gap-3">
        <label class="space-y-1.5">
          <span class="text-xs font-medium text-muted">{{ t('itinerary.startDate') }}</span>
          <input
            v-model="start"
            type="date"
            class="tabular h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm focus:border-accent focus:outline-none"
          />
        </label>
        <label class="space-y-1.5">
          <span class="text-xs font-medium text-muted">{{ t('itinerary.endDate') }}</span>
          <input
            v-model="end"
            type="date"
            :min="start"
            class="tabular h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm focus:border-accent focus:outline-none"
          />
        </label>
      </div>
      <p v-if="datesError" class="mt-2 text-xs text-negative">{{ datesError }}</p>
      <div class="mt-4"><AppButton block @click="saveDates">{{ t('common.save') }}</AppButton></div>
    </section>

    <template v-else>
      <section class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <p class="text-sm font-medium">{{ t('itinerary.summary', { days: layout.days.length }) }}</p>
          <p v-if="estimate" class="tabular text-xs text-muted">
            {{ t('itinerary.estimateTotal', { amount: money(estimate), currency: group.currency }) }}
          </p>
        </div>
        <button
          class="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-accent/40 bg-accent-soft px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:border-accent"
          @click="emit('ai')"
        >
          <Sparkles class="size-3.5" />
          {{ t('ai.title') }}
        </button>
      </section>

      <section class="rounded-card border border-border bg-surface p-4 shadow-card">
        <header class="mb-2 flex items-center justify-between">
          <h2 class="text-xs font-medium text-muted">{{ t('itinerary.logistics') }}</h2>
          <div class="flex gap-3">
            <button class="text-xs font-medium text-accent" @click="emit('add', group.startDate, 'flight')">
              + {{ t('itinerary.kind.flight') }}
            </button>
            <button class="text-xs font-medium text-accent" @click="emit('add', group.startDate, 'lodging')">
              + {{ t('itinerary.kind.lodging') }}
            </button>
          </div>
        </header>
        <p v-if="!logistics.length" class="py-2 text-xs text-faint">{{ t('itinerary.noLogistics') }}</p>
        <ul v-else class="divide-y divide-border">
          <li v-for="item in logistics" :key="item.id">
            <button class="flex w-full items-center gap-3 py-2.5 text-left" @click="emit('edit', item)">
              <component :is="KIND_ICON[item.kind]" class="size-4 shrink-0 text-muted" />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium">{{ item.title }}</span>
                <span class="tabular block text-xs text-muted">
                  {{ formatDay(item.date, locale) }}{{ item.time ? ` ${item.time}` : '' }}
                  <template v-if="item.kind === 'lodging' && item.endDate">
                    → {{ formatDay(item.endDate, locale) }}
                  </template>
                </span>
              </span>
            </button>
          </li>
        </ul>
      </section>

      <section v-for="day in layout.days" :key="day.date">
        <header class="mb-2 flex items-baseline justify-between">
          <h2 class="text-sm font-semibold" :class="day.date === today ? 'text-accent' : ''">
            {{ t('itinerary.dayLabel', { n: day.index }) }}
            <span class="font-normal text-muted">· {{ formatDay(day.date, locale) }}</span>
          </h2>
          <span v-if="day.estimateMinor" class="tabular text-xs text-faint">
            {{ t('stats.estimated') }} {{ money(day.estimateMinor) }}
          </span>
        </header>

        <div class="space-y-2">
          <article
            v-for="item in day.items"
            :key="item.id"
            class="flex items-start gap-3 rounded-card border border-border bg-surface p-3.5 shadow-card"
          >
            <span class="tabular w-11 shrink-0 pt-0.5 text-xs font-medium text-muted">
              {{ item.time || t('itinerary.allDay') }}
            </span>
            <button class="min-w-0 flex-1 text-left" @click="emit('edit', item)">
              <span class="flex items-center gap-1.5">
                <span aria-hidden="true">{{ item.kind === 'spot' ? categoryEmoji(item.category) : '' }}</span>
                <component v-if="item.kind !== 'spot'" :is="KIND_ICON[item.kind]" class="size-3.5 text-muted" />
                <span class="truncate text-sm font-medium">{{ item.title }}</span>
              </span>
              <span v-if="item.note" class="mt-0.5 block text-xs text-muted">{{ item.note }}</span>
              <span class="mt-1 block text-[11px] text-faint">
                <template v-if="item.estimateMinor">
                  {{ t('stats.estimated') }} {{ money(item.estimateMinor) }} ·
                </template>
                {{ t('itinerary.editedBy', { name: editorName(item) }) }}
              </span>
            </button>
            <div class="flex shrink-0 gap-0.5">
              <a
                :href="mapsUrl(item)"
                target="_blank"
                rel="noopener"
                class="grid size-8 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-fg"
                :aria-label="t('itinerary.openMap')"
              >
                <MapPin class="size-4" />
              </a>
              <button
                class="grid size-8 place-items-center rounded-full text-muted transition-colors hover:bg-accent-soft hover:text-accent"
                :aria-label="t('itinerary.record')"
                :title="t('itinerary.record')"
                @click="emit('record', item)"
              >
                <ReceiptText class="size-4" />
              </button>
            </div>
          </article>

          <button
            class="flex w-full items-center justify-center gap-1.5 rounded-card border border-dashed border-border py-2.5 text-xs text-muted transition-colors hover:border-accent hover:text-accent"
            @click="emit('add', day.date, 'spot')"
          >
            <Plus class="size-3.5" />
            {{ t('itinerary.addSpot') }}
          </button>
        </div>
      </section>
    </template>

    <!-- Without trip dates nothing is "out of range" yet — just unscheduled. -->
    <section
      v-if="layout.outside.length"
      class="rounded-card border p-4"
      :class="hasDates ? 'border-negative/40 bg-negative-soft' : 'border-border bg-surface shadow-card'"
    >
      <div class="flex items-center gap-2" :class="hasDates ? 'text-negative' : ''">
        <AlertTriangle v-if="hasDates" class="size-4" />
        <h2 class="text-sm font-semibold">
          {{ hasDates ? t('itinerary.outsideTitle') : t('itinerary.unscheduledTitle') }}
        </h2>
      </div>
      <p v-if="hasDates" class="mt-1 text-xs text-muted">{{ t('itinerary.outsideHint') }}</p>
      <ul class="mt-3 space-y-1.5">
        <li v-for="item in layout.outside" :key="item.id">
          <button class="flex w-full items-center justify-between gap-3 text-left text-sm" @click="emit('edit', item)">
            <span class="truncate">{{ item.title }}</span>
            <span class="tabular shrink-0 text-xs text-muted">{{ formatDay(item.date, locale) }}</span>
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>
