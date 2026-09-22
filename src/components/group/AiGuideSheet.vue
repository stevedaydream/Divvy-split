<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ExternalLink, KeyRound, Sparkles } from 'lucide-vue-next'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppSheet from '@/components/ui/AppSheet.vue'
import { categoryEmoji } from '@/data/categories'
import { placeLabel } from '@/data/countries'
import {
  adjustPrompt, parseAdjustment, parseItems, parsePrompt, planPrompt, type AiStyle, type TripContext,
} from '@/lib/ai'
import { formatDay } from '@/lib/dates'
import { askGemini, GeminiRequestError, readGeminiKey, writeGeminiKey } from '@/lib/gemini'
import { formatNumber } from '@/lib/money'
import { createItem, deleteItem, type ItineraryDraft } from '@/services/itinerary'
import { useToast } from '@/composables/useToast'
import type { Group, ItineraryItem } from '@/types/models'

const props = defineProps<{
  open: boolean
  group: Group
  items: ItineraryItem[]
  uid: string
  locale: string
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const toast = useToast()

type Mode = 'plan' | 'adjust' | 'parse'
const MODES: Mode[] = ['plan', 'adjust', 'parse']
const STYLES: AiStyle[] = ['packed', 'balanced', 'relaxed']
const THEMES = ['food', 'nature', 'culture', 'shopping', 'family', 'nightlife'] as const

const apiKey = ref(readGeminiKey())
const keyDraft = ref('')
const mode = ref<Mode>('plan')
const style = ref<AiStyle>('balanced')
const themes = ref<string[]>([])
const extra = ref('')
const instruction = ref('')
const booking = ref('')
const loading = ref(false)
const error = ref('')

interface Suggestion { draft: ItineraryDraft; selected: boolean }
interface Removal { item: ItineraryItem; selected: boolean }
const additions = ref<Suggestion[]>([])
const removals = ref<Removal[]>([])
const summary = ref('')
const hasResult = computed(() => additions.value.length > 0 || removals.value.length > 0)
const selectedCount = computed(
  () => additions.value.filter((s) => s.selected).length + removals.value.filter((r) => r.selected).length,
)

let controller: AbortController | null = null

function resetResult(): void {
  additions.value = []
  removals.value = []
  summary.value = ''
  error.value = ''
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      apiKey.value = readGeminiKey()
      resetResult()
    } else {
      controller?.abort()
    }
  },
)
watch(mode, resetResult)

function saveKey(): void {
  writeGeminiKey(keyDraft.value)
  apiKey.value = readGeminiKey()
  keyDraft.value = ''
}

function toggleTheme(theme: string): void {
  themes.value = themes.value.includes(theme) ? themes.value.filter((x) => x !== theme) : [...themes.value, theme]
}

const trip = computed<TripContext>(() => ({
  destination: placeLabel(props.group.location, props.group.destination, props.locale),
  startDate: props.group.startDate,
  endDate: props.group.endDate,
  currency: props.group.currency,
  language: props.locale.startsWith('zh') ? '繁體中文（台灣用語）' : 'English',
}))

const canRun = computed(() => {
  if (mode.value === 'adjust') return instruction.value.trim().length > 0 && props.items.length > 0
  if (mode.value === 'parse') return booking.value.trim().length > 0
  return true
})

async function run(): Promise<void> {
  if (!apiKey.value || !canRun.value) return
  resetResult()
  loading.value = true
  controller?.abort()
  controller = new AbortController()

  try {
    const prompt =
      mode.value === 'plan'
        ? planPrompt(trip.value, style.value, themes.value.map((x) => t(`ai.theme.${x}`)), extra.value)
        : mode.value === 'adjust'
          ? adjustPrompt(trip.value, props.items, instruction.value)
          : parsePrompt(trip.value, booking.value)
    const reply = await askGemini(apiKey.value, prompt, controller.signal)

    if (mode.value === 'adjust') {
      const result = parseAdjustment(reply, trip.value, props.items.map((i) => i.id))
      const byId = new Map(props.items.map((i) => [i.id, i]))
      summary.value = result.summary
      removals.value = result.remove.map((id) => ({ item: byId.get(id)!, selected: true }))
      additions.value = result.add.map((draft) => ({ draft, selected: true }))
    } else {
      additions.value = parseItems(reply, trip.value).map((draft) => ({ draft, selected: true }))
    }
    if (!hasResult.value) error.value = t('ai.empty')
  } catch (cause) {
    if ((cause as Error).name === 'AbortError') return
    const reason = cause instanceof GeminiRequestError ? cause.reason : 'failed'
    error.value = t(`ai.error.${reason}`)
  } finally {
    loading.value = false
  }
}

const applying = ref(false)

async function apply(): Promise<void> {
  applying.value = true
  try {
    await Promise.all([
      ...additions.value.filter((s) => s.selected).map((s) => createItem(props.group.id, s.draft, props.uid)),
      ...removals.value.filter((r) => r.selected).map((r) => deleteItem(props.group.id, r.item.id)),
    ])
    toast.success(t('ai.applied', { count: selectedCount.value }))
    emit('close')
  } catch {
    toast.error(t('common.somethingWrong'))
  } finally {
    applying.value = false
  }
}

const money = (minor: number) => formatNumber(minor, props.group.currency, props.locale)
</script>

<template>
  <AppSheet :open="open" :title="t('ai.title')" @close="emit('close')">
    <!-- No key yet: explain and collect it, stored on this device only. -->
    <section v-if="!apiKey" class="space-y-3">
      <div class="flex items-center gap-2">
        <KeyRound class="size-4 text-accent" />
        <h3 class="text-sm font-semibold">{{ t('ai.keyTitle') }}</h3>
      </div>
      <p class="text-xs leading-relaxed text-muted">{{ t('ai.keyHint') }}</p>
      <a
        href="https://aistudio.google.com/apikey"
        target="_blank"
        rel="noopener"
        class="inline-flex items-center gap-1 text-xs font-medium text-accent"
      >
        {{ t('ai.getKey') }} <ExternalLink class="size-3" />
      </a>
      <AppInput v-model="keyDraft" type="password" autocomplete="off" :placeholder="t('ai.keyPlaceholder')" />
      <AppButton block :disabled="!keyDraft.trim()" @click="saveKey">{{ t('common.save') }}</AppButton>
    </section>

    <template v-else>
      <div class="mb-5 grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1">
        <button
          v-for="option in MODES"
          :key="option"
          class="rounded-lg py-2 text-xs font-medium transition-colors"
          :class="mode === option ? 'bg-surface text-fg shadow-card' : 'text-muted'"
          :aria-pressed="mode === option"
          @click="mode = option"
        >
          {{ t(`ai.mode.${option}`) }}
        </button>
      </div>

      <section v-if="mode === 'plan'" class="space-y-4">
        <div>
          <h3 class="mb-2 text-xs font-medium text-muted">{{ t('ai.pace') }}</h3>
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="option in STYLES"
              :key="option"
              class="h-9 rounded-lg border text-sm transition-colors"
              :class="style === option ? 'border-accent bg-accent-soft font-medium text-accent' : 'border-border text-muted'"
              @click="style = option"
            >
              {{ t(`ai.style.${option}`) }}
            </button>
          </div>
        </div>
        <div>
          <h3 class="mb-2 text-xs font-medium text-muted">{{ t('ai.interests') }}</h3>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="theme in THEMES"
              :key="theme"
              class="rounded-lg border px-3 py-1.5 text-sm transition-colors"
              :class="themes.includes(theme) ? 'border-accent bg-accent-soft text-accent' : 'border-border text-muted'"
              @click="toggleTheme(theme)"
            >
              {{ t(`ai.theme.${theme}`) }}
            </button>
          </div>
        </div>
        <AppInput v-model="extra" :placeholder="t('ai.extraPlaceholder')" />
      </section>

      <section v-else-if="mode === 'adjust'" class="space-y-2">
        <p v-if="!items.length" class="text-xs text-faint">{{ t('ai.adjustEmpty') }}</p>
        <AppInput v-model="instruction" :placeholder="t('ai.adjustPlaceholder')" />
      </section>

      <section v-else class="space-y-2">
        <textarea
          v-model="booking"
          rows="6"
          maxlength="8000"
          :placeholder="t('ai.parsePlaceholder')"
          class="w-full rounded-xl border border-border bg-surface px-3.5 py-3 text-sm placeholder:text-faint focus:border-accent focus:outline-none"
        />
        <p class="text-[11px] text-faint">{{ t('ai.parseHint') }}</p>
      </section>

      <div class="mt-5">
        <AppButton block :loading="loading" :disabled="!canRun" @click="run">
          <template #icon><Sparkles class="size-4" /></template>
          {{ t(`ai.run.${mode}`) }}
        </AppButton>
      </div>

      <p v-if="error" class="mt-3 text-center text-xs text-negative">{{ error }}</p>

      <section v-if="hasResult" class="mt-6 space-y-2">
        <p v-if="summary" class="text-sm">{{ summary }}</p>
        <p class="text-xs text-muted">{{ t('ai.reviewHint') }}</p>

        <label
          v-for="(removal, i) in removals"
          :key="`r${i}`"
          class="flex cursor-pointer items-start gap-3 rounded-xl border border-negative/40 bg-negative-soft p-3"
        >
          <input v-model="removal.selected" type="checkbox" class="mt-1 accent-[var(--c-negative)]" />
          <span class="min-w-0 flex-1 text-sm">
            <span class="text-xs font-medium text-negative">{{ t('ai.remove') }}</span>
            <span class="block truncate line-through">{{ removal.item.title }}</span>
            <span class="tabular text-xs text-muted">{{ formatDay(removal.item.date, locale) }} {{ removal.item.time }}</span>
          </span>
        </label>

        <label
          v-for="(suggestion, i) in additions"
          :key="`a${i}`"
          class="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3"
        >
          <input v-model="suggestion.selected" type="checkbox" class="mt-1 accent-[var(--c-accent)]" />
          <span class="min-w-0 flex-1 text-sm">
            <span class="flex items-center gap-1.5">
              <span aria-hidden="true">{{ categoryEmoji(suggestion.draft.category) }}</span>
              <span class="truncate font-medium">{{ suggestion.draft.title }}</span>
            </span>
            <span class="tabular block text-xs text-muted">
              {{ formatDay(suggestion.draft.date, locale) }} {{ suggestion.draft.time }}
              <template v-if="suggestion.draft.estimateMinor">· {{ money(suggestion.draft.estimateMinor) }} {{ group.currency }}</template>
            </span>
            <span v-if="suggestion.draft.note" class="block text-xs text-faint">{{ suggestion.draft.note }}</span>
          </span>
        </label>
      </section>

      <button class="mt-6 block w-full text-center text-[11px] text-faint hover:text-negative" @click="writeGeminiKey(''); apiKey = ''">
        {{ t('ai.forgetKey') }}
      </button>
    </template>

    <template v-if="hasResult" #footer>
      <AppButton block :loading="applying" :disabled="!selectedCount" @click="apply">
        {{ t('ai.apply', { count: selectedCount }) }}
      </AppButton>
    </template>
  </AppSheet>
</template>
