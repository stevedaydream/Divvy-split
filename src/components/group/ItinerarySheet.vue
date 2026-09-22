<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Trash2 } from 'lucide-vue-next'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppSheet from '@/components/ui/AppSheet.vue'
import { CATEGORIES, guessCategory } from '@/data/categories'
import { addDays } from '@/lib/dates'
import { hasTripDates } from '@/lib/itinerary'
import { toMajor, toMinor } from '@/lib/money'
import type { ItineraryDraft } from '@/services/itinerary'
import type { EntryCategory, Group, ItineraryItem, ItineraryKind } from '@/types/models'

const props = defineProps<{
  open: boolean
  group: Group
  /** Set when editing; null when adding. */
  item: ItineraryItem | null
  /** Day a new item starts on. */
  presetDate: string
  /** Kind a new item starts as. */
  presetKind?: ItineraryKind
}>()

const emit = defineEmits<{ close: []; save: [draft: ItineraryDraft]; remove: [] }>()

const { t } = useI18n()

const KINDS: ItineraryKind[] = ['spot', 'flight', 'lodging']
const KIND_CATEGORY: Record<ItineraryKind, EntryCategory | null> = {
  spot: null,
  flight: 'transport',
  lodging: 'lodging',
}

const kind = ref<ItineraryKind>('spot')
const date = ref('')
const time = ref('')
const endDate = ref('')
const title = ref('')
const place = ref('')
const note = ref('')
const estimate = ref('')
const category = ref<EntryCategory>('other')
const categoryTouched = ref(false)
const error = ref('')

const bounds = computed(() =>
  hasTripDates(props.group.startDate, props.group.endDate)
    ? { min: props.group.startDate, max: props.group.endDate }
    : { min: undefined, max: undefined },
)

function autoCategory(): void {
  if (categoryTouched.value) return
  category.value = KIND_CATEGORY[kind.value] ?? guessCategory(title.value) ?? 'other'
}

watch([kind, title], autoCategory)

function pickCategory(code: EntryCategory): void {
  category.value = code
  categoryTouched.value = true
}

watch(
  () => props.open,
  (open) => {
    if (!open) return
    error.value = ''
    const item = props.item
    if (item) {
      categoryTouched.value = true
      kind.value = item.kind
      date.value = item.date
      time.value = item.time
      endDate.value = item.endDate
      title.value = item.title
      place.value = item.place
      note.value = item.note
      estimate.value = item.estimateMinor ? String(toMajor(item.estimateMinor, props.group.currency)) : ''
      category.value = item.category
      return
    }
    categoryTouched.value = false
    kind.value = props.presetKind ?? 'spot'
    date.value = props.presetDate
    time.value = ''
    endDate.value = props.presetKind === 'lodging' ? addDays(props.presetDate, 1) : ''
    title.value = ''
    place.value = ''
    note.value = ''
    estimate.value = ''
    autoCategory()
  },
)

// Check-out defaults to the night after check-in and can never precede it.
watch([kind, date], ([nextKind, nextDate]) => {
  if (nextKind !== 'lodging') return
  if (!endDate.value || endDate.value <= nextDate) endDate.value = addDays(nextDate, 1)
})

function submit(): void {
  if (!title.value.trim()) {
    error.value = t('itinerary.titleRequired')
    return
  }
  if (!date.value) {
    error.value = t('group.dateRequired')
    return
  }
  const estimateMinor = Math.max(0, toMinor(estimate.value || '0', props.group.currency))
  error.value = ''
  emit('save', {
    kind: kind.value,
    date: date.value,
    time: time.value,
    endDate: kind.value === 'lodging' ? endDate.value : '',
    title: title.value.trim().slice(0, 120),
    place: place.value.trim().slice(0, 200),
    note: note.value.trim().slice(0, 500),
    estimateMinor,
    category: category.value,
  })
}
</script>

<template>
  <AppSheet
    :open="open"
    :title="item ? t('itinerary.editItem') : t('itinerary.addItem')"
    @close="emit('close')"
  >
    <div class="mb-6 grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1">
      <button
        v-for="option in KINDS"
        :key="option"
        class="rounded-lg py-2 text-sm font-medium transition-colors"
        :class="kind === option ? 'bg-surface text-fg shadow-card' : 'text-muted'"
        :aria-pressed="kind === option"
        @click="kind = option"
      >
        {{ t(`itinerary.kind.${option}`) }}
      </button>
    </div>

    <div class="space-y-5">
      <AppInput v-model="title" :placeholder="t(`itinerary.titlePlaceholder.${kind}`)" />

      <div class="grid grid-cols-2 gap-3">
        <label class="space-y-1.5">
          <span class="text-xs font-medium text-muted">
            {{ kind === 'lodging' ? t('itinerary.checkIn') : t('group.date') }}
          </span>
          <input
            v-model="date"
            type="date"
            :min="bounds.min"
            :max="bounds.max"
            class="tabular h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm focus:border-accent focus:outline-none"
          />
        </label>
        <label v-if="kind === 'lodging'" class="space-y-1.5">
          <span class="text-xs font-medium text-muted">{{ t('itinerary.checkOut') }}</span>
          <input
            v-model="endDate"
            type="date"
            :min="date ? addDays(date, 1) : undefined"
            class="tabular h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm focus:border-accent focus:outline-none"
          />
        </label>
        <label v-else class="space-y-1.5">
          <span class="text-xs font-medium text-muted">{{ t('itinerary.time') }}</span>
          <input
            v-model="time"
            type="time"
            class="tabular h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm focus:border-accent focus:outline-none"
          />
        </label>
      </div>

      <AppInput v-model="place" :placeholder="t('itinerary.placePlaceholder')" />
      <AppInput v-model="note" :placeholder="t('itinerary.notePlaceholder')" />

      <label class="block space-y-1.5">
        <span class="text-xs font-medium text-muted">
          {{ t('itinerary.estimate', { currency: group.currency }) }}
        </span>
        <AppInput v-model="estimate" type="text" inputmode="decimal" mono placeholder="0" />
      </label>

      <section>
        <h3 class="mb-2 text-xs font-medium text-muted">{{ t('group.category') }}</h3>
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="option in CATEGORIES"
            :key="option.code"
            type="button"
            class="flex h-10 items-center justify-center gap-1.5 rounded-lg border text-sm transition-colors"
            :class="
              category === option.code
                ? 'border-accent bg-accent-soft font-medium text-accent'
                : 'border-border text-muted'
            "
            :aria-pressed="category === option.code"
            @click="pickCategory(option.code)"
          >
            <span aria-hidden="true">{{ option.emoji }}</span>
            {{ t(`category.${option.code}`) }}
          </button>
        </div>
      </section>

      <p v-if="error" class="text-center text-xs text-negative">{{ error }}</p>
    </div>

    <template #footer>
      <div class="flex gap-3">
        <AppButton v-if="item" variant="danger" :aria-label="t('common.delete')" @click="emit('remove')">
          <template #icon><Trash2 class="size-4" /></template>
        </AppButton>
        <AppButton variant="secondary" class="flex-1" @click="emit('close')">{{ t('common.cancel') }}</AppButton>
        <AppButton class="flex-1" @click="submit">{{ t('common.save') }}</AppButton>
      </div>
    </template>
  </AppSheet>
</template>
