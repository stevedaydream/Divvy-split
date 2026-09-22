<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ImagePlus, Sparkles, X } from 'lucide-vue-next'
import AppButton from '@/components/ui/AppButton.vue'
import AppSheet from '@/components/ui/AppSheet.vue'
import AiKeySetup from '@/components/ai/AiKeySetup.vue'
import AiStatus from '@/components/ai/AiStatus.vue'
import { placeLabel } from '@/data/countries'
import { checklistPrompt, parseChecklist, type ChecklistTarget } from '@/lib/ai'
import { GeminiRequestError } from '@/lib/gemini'
import { toAiImage } from '@/lib/images'
import { addChecklistItems } from '@/services/checklists'
import { useAiAsk } from '@/composables/useAiAsk'
import { useToast } from '@/composables/useToast'
import type { Group } from '@/types/models'

/**
 * Tidies a travel agency's or friend's list — pasted text or screenshots —
 * into packing items (personal) and to-dos (shared), previewed before adding.
 */
const props = defineProps<{
  open: boolean
  group: Group
  uid: string
  locale: string
  /** Lines already on either list; duplicates are skipped. */
  existing: string[]
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const toast = useToast()
const { apiKey, usedFallback, blocked, refresh, saveKey, resetTime, ask } = useAiAsk(() => props.locale)

const MAX_IMAGES = 4
const text = ref('')
const images = ref<{ file: File; url: string }[]>([])
const loading = ref(false)
const applying = ref(false)
const error = ref('')

interface Row { text: string; list: ChecklistTarget; selected: boolean }
const rows = ref<Row[]>([])
const selected = computed(() => rows.value.filter((r) => r.selected))

let controller: AbortController | null = null

function clearImages(): void {
  images.value.forEach((image) => URL.revokeObjectURL(image.url))
  images.value = []
}
onScopeDispose(clearImages)

watch(
  () => props.open,
  (open) => {
    if (open) {
      refresh()
      text.value = ''
      clearImages()
      rows.value = []
      error.value = ''
    } else {
      controller?.abort()
    }
  },
)

function addImages(event: Event): void {
  const input = event.target as HTMLInputElement
  const files = [...(input.files ?? [])].slice(0, MAX_IMAGES - images.value.length)
  input.value = ''
  images.value = [...images.value, ...files.map((file) => ({ file, url: URL.createObjectURL(file) }))]
}

function removeImage(index: number): void {
  const [image] = images.value.splice(index, 1)
  if (image) URL.revokeObjectURL(image.url)
}

const canRun = computed(() => (text.value.trim().length > 0 || images.value.length > 0) && !blocked.value)

async function run(): Promise<void> {
  if (!canRun.value) return
  loading.value = true
  error.value = ''
  rows.value = []
  controller?.abort()
  controller = new AbortController()

  try {
    const prepared = await Promise.all(images.value.map((image) => toAiImage(image.file)))
    const prompt = checklistPrompt(
      {
        destination: placeLabel(props.group.location, props.group.destination, props.locale),
        startDate: props.group.startDate,
        endDate: props.group.endDate,
        currency: props.group.currency,
        language: props.locale.startsWith('zh') ? '繁體中文（台灣用語）' : 'English',
      },
      text.value,
      prepared.length,
    )
    const reply = await ask(prompt, controller.signal, prepared)
    rows.value = parseChecklist(reply, props.existing).map((s) => ({ ...s, selected: true }))
    if (!rows.value.length) error.value = t('importList.empty')
  } catch (cause) {
    if ((cause as Error).name === 'AbortError') return
    const reason = cause instanceof GeminiRequestError ? cause.reason : 'failed'
    error.value = reason === 'quota' ? t('ai.quotaNoFallback', { time: resetTime() }) : t(`ai.error.${reason}`)
  } finally {
    loading.value = false
  }
}

async function apply(): Promise<void> {
  const packing = selected.value.filter((r) => r.list === 'packing').map((r) => r.text)
  const todos = selected.value.filter((r) => r.list === 'todo').map((r) => r.text)
  applying.value = true
  try {
    await Promise.all([
      packing.length ? addChecklistItems('packing', props.group.id, props.uid, packing) : null,
      todos.length ? addChecklistItems('todo', props.group.id, props.uid, todos) : null,
    ])
    toast.success(t('importList.added', { packing: packing.length, todos: todos.length }))
    emit('close')
  } catch {
    toast.error(t('common.somethingWrong'))
  } finally {
    applying.value = false
  }
}
</script>

<template>
  <AppSheet :open="open" :title="t('importList.title')" @close="emit('close')">
    <AiKeySetup v-if="!apiKey" @save="saveKey" />

    <template v-else>
      <p class="mb-4 text-xs leading-relaxed text-muted">{{ t('importList.hint') }}</p>

      <textarea
        v-model="text"
        rows="5"
        maxlength="8000"
        :placeholder="t('importList.placeholder')"
        class="w-full rounded-xl border border-border bg-surface px-3.5 py-3 text-sm placeholder:text-faint focus:border-accent focus:outline-none"
      />

      <div class="mt-3 flex flex-wrap gap-2">
        <div v-for="(image, i) in images" :key="image.url" class="relative size-16">
          <img :src="image.url" alt="" class="size-16 rounded-lg border border-border object-cover" />
          <button
            class="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-surface text-muted shadow-card hover:text-negative"
            :aria-label="t('common.delete')"
            @click="removeImage(i)"
          >
            <X class="size-3" />
          </button>
        </div>
        <label
          v-if="images.length < MAX_IMAGES"
          class="grid size-16 cursor-pointer place-items-center rounded-lg border border-dashed border-border text-muted transition-colors hover:border-accent hover:text-accent"
          :aria-label="t('importList.addImage')"
        >
          <ImagePlus class="size-5" />
          <input type="file" accept="image/*" multiple class="sr-only" @change="addImages" />
        </label>
      </div>
      <p class="mt-1.5 text-[11px] text-faint">{{ t('importList.imageHint', { max: MAX_IMAGES }) }}</p>

      <AiStatus v-if="blocked && !usedFallback && !error" kind="blocked" :time="resetTime()" class="mt-4" />

      <div class="mt-4">
        <AppButton block :loading="loading" :disabled="!canRun" @click="run">
          <template #icon><Sparkles class="size-4" /></template>
          {{ t('importList.run') }}
        </AppButton>
      </div>

      <p v-if="error" class="mt-3 text-center text-xs text-negative">{{ error }}</p>

      <section v-if="rows.length" class="mt-6 space-y-2">
        <AiStatus v-if="usedFallback" kind="fallback" :time="resetTime()" />
        <p class="text-xs text-muted">{{ t('importList.reviewHint') }}</p>

        <div
          v-for="(row, i) in rows"
          :key="i"
          class="flex items-center gap-3 rounded-xl border border-border px-3 py-2"
          :class="row.selected ? '' : 'opacity-50'"
        >
          <input v-model="row.selected" type="checkbox" class="accent-[var(--c-accent)]" :aria-label="row.text" />
          <span class="min-w-0 flex-1 truncate text-sm">{{ row.text }}</span>
          <!-- Tap to move between the personal packing list and shared to-dos. -->
          <button
            class="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors"
            :class="row.list === 'packing' ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-muted'"
            :aria-label="t('importList.switchList')"
            @click="row.list = row.list === 'packing' ? 'todo' : 'packing'"
          >
            {{ row.list === 'packing' ? t('importList.toPacking') : t('importList.toTodo') }}
          </button>
        </div>
      </section>
    </template>

    <template v-if="rows.length" #footer>
      <AppButton block :loading="applying" :disabled="!selected.length" @click="apply">
        {{ t('importList.apply', { count: selected.length }) }}
      </AppButton>
    </template>
  </AppSheet>
</template>
