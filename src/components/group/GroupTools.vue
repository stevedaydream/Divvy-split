<script setup lang="ts">
import { onScopeDispose, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ImagePlus, QrCode, Trash2, X } from 'lucide-vue-next'
import ChecklistCard from '@/components/group/ChecklistCard.vue'
import {
  addChecklistItem, addChecklistItems, deleteChecklistItem, setChecklistDone, watchChecklist,
  type ChecklistKind,
} from '@/services/checklists'
import { readQrImages, shrinkImage, writeQrImages, type QrImages, type QrSlot } from '@/lib/entryQr'
import { useToast } from '@/composables/useToast'
import type { ChecklistItem, Group } from '@/types/models'

const props = defineProps<{ group: Group; uid: string }>()

const { t } = useI18n()
const toast = useToast()

// --- checklists --------------------------------------------------------------

const packing = ref<ChecklistItem[]>([])
const todos = ref<ChecklistItem[]>([])
let stops: (() => void)[] = []

watch(
  () => [props.group.id, props.uid] as const,
  ([groupId, uid]) => {
    stops.forEach((stop) => stop())
    stops = []
    if (!uid) return
    stops.push(watchChecklist('packing', groupId, uid, (items) => (packing.value = items)))
    stops.push(watchChecklist('todo', groupId, uid, (items) => (todos.value = items)))
  },
  { immediate: true },
)
onScopeDispose(() => stops.forEach((stop) => stop()))

async function run(action: () => Promise<void>): Promise<void> {
  try {
    await action()
  } catch {
    toast.error(t('common.somethingWrong'))
  }
}

const add = (kind: ChecklistKind, text: string) =>
  run(() => addChecklistItem(kind, props.group.id, props.uid, text))
const toggle = (kind: ChecklistKind, item: ChecklistItem) =>
  run(() => setChecklistDone(kind, props.group.id, props.uid, item, !item.done))
const remove = (kind: ChecklistKind, item: ChecklistItem) =>
  run(() => deleteChecklistItem(kind, props.group.id, props.uid, item))

function addPackingPreset(): void {
  const texts = t('tools.packingPreset').split(',').map((s) => s.trim()).filter(Boolean)
  void run(() => addChecklistItems('packing', props.group.id, props.uid, texts))
}

const nameOf = (uid: string) => props.group.members[uid]?.nickname ?? t('common.unknown')

// --- arrival QR codes (this device only) ---------------------------------------

const SLOTS: QrSlot[] = ['immigration', 'customs']
const qr = ref<QrImages>(readQrImages(props.group.id))
const enlarged = ref<QrSlot | null>(null)

watch(() => props.group.id, (id) => (qr.value = readQrImages(id)))

async function upload(slot: QrSlot, event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const next = { ...qr.value, [slot]: await shrinkImage(file) }
    if (!writeQrImages(props.group.id, next)) throw new Error('storage')
    qr.value = next
  } catch {
    toast.error(t('tools.qrSaveFailed'))
  }
}

function clearQr(slot: QrSlot): void {
  const next = { ...qr.value }
  delete next[slot]
  writeQrImages(props.group.id, next)
  qr.value = next
}
</script>

<template>
  <div class="space-y-4 px-5 pb-28 pt-5">
    <ChecklistCard
      :title="t('tools.packing')"
      :hint="t('tools.packingHint')"
      :items="packing"
      :preset-label="t('tools.packingPresetAction')"
      @add="add('packing', $event)"
      @toggle="toggle('packing', $event)"
      @remove="remove('packing', $event)"
      @preset="addPackingPreset"
    />

    <ChecklistCard
      :title="t('tools.todos')"
      :hint="t('tools.todosHint')"
      :items="todos"
      :name-of="group.memberIds.length > 1 ? nameOf : undefined"
      @add="add('todo', $event)"
      @toggle="toggle('todo', $event)"
      @remove="remove('todo', $event)"
    />

    <section class="rounded-card border border-border bg-surface p-4 shadow-card">
      <div class="flex items-center gap-2">
        <QrCode class="size-4 text-muted" />
        <h2 class="text-sm font-semibold">{{ t('tools.qr') }}</h2>
      </div>
      <p class="mt-0.5 text-[11px] leading-relaxed text-faint">{{ t('tools.qrHint') }}</p>

      <div class="mt-3 grid grid-cols-2 gap-3">
        <div v-for="slot in SLOTS" :key="slot" class="space-y-1.5">
          <p class="text-xs font-medium text-muted">{{ t(`tools.qrSlot.${slot}`) }}</p>
          <div v-if="qr[slot]" class="relative">
            <button
              class="block w-full overflow-hidden rounded-xl border border-border bg-white"
              :aria-label="t('tools.qrEnlarge')"
              @click="enlarged = slot"
            >
              <img :src="qr[slot]" :alt="t(`tools.qrSlot.${slot}`)" class="aspect-square w-full object-contain" />
            </button>
            <button
              class="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-surface/90 text-muted shadow-card hover:text-negative"
              :aria-label="t('common.delete')"
              @click="clearQr(slot)"
            >
              <Trash2 class="size-3.5" />
            </button>
          </div>
          <label
            v-else
            class="grid aspect-square w-full cursor-pointer place-items-center rounded-xl border border-dashed border-border text-muted transition-colors hover:border-accent hover:text-accent"
          >
            <span class="flex flex-col items-center gap-1 text-xs">
              <ImagePlus class="size-5" />
              {{ t('tools.qrUpload') }}
            </span>
            <input type="file" accept="image/*" class="sr-only" @change="upload(slot, $event)" />
          </label>
        </div>
      </div>
    </section>

    <!-- Full-screen, on white, so an officer's scanner reads it easily. -->
    <Teleport to="body">
      <div
        v-if="enlarged && qr[enlarged]"
        class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white p-6"
        role="dialog"
        aria-modal="true"
        @click="enlarged = null"
      >
        <p class="mb-4 text-sm font-medium text-zinc-900">{{ t(`tools.qrSlot.${enlarged}`) }}</p>
        <img :src="qr[enlarged]" :alt="t(`tools.qrSlot.${enlarged}`)" class="max-h-[75dvh] w-full max-w-md object-contain" />
        <button class="mt-6 grid size-11 place-items-center rounded-full bg-zinc-100 text-zinc-700" :aria-label="t('common.close')">
          <X class="size-5" />
        </button>
      </div>
    </Teleport>
  </div>
</template>
