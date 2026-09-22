<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, Plus, Sparkles, X } from 'lucide-vue-next'
import type { ChecklistItem } from '@/types/models'

const props = defineProps<{
  title: string
  hint: string
  items: ChecklistItem[]
  /** Nickname lookup; when given, shows who last ticked a shared item. */
  nameOf?: (uid: string) => string
  /** Offer a one-tap starter list while the checklist is empty. */
  presetLabel?: string
  /** Optional AI action in the header, e.g. importing someone else's list. */
  actionLabel?: string
}>()

const emit = defineEmits<{
  add: [text: string]
  toggle: [item: ChecklistItem]
  remove: [item: ChecklistItem]
  preset: []
  action: []
}>()

const { t } = useI18n()
const draft = ref('')
const done = computed(() => props.items.filter((i) => i.done).length)

function submit(): void {
  const text = draft.value.trim()
  if (!text) return
  emit('add', text)
  draft.value = ''
}
</script>

<template>
  <section class="rounded-card border border-border bg-surface p-4 shadow-card">
    <header class="flex items-baseline justify-between">
      <h2 class="text-sm font-semibold">{{ title }}</h2>
      <span class="flex items-center gap-3">
        <span v-if="items.length" class="tabular text-xs text-muted">{{ done }} / {{ items.length }}</span>
        <button
          v-if="actionLabel"
          class="inline-flex items-center gap-1 text-xs font-medium text-accent"
          @click="emit('action')"
        >
          <Sparkles class="size-3.5" /> {{ actionLabel }}
        </button>
      </span>
    </header>
    <p class="mt-0.5 text-[11px] text-faint">{{ hint }}</p>

    <ul v-if="items.length" class="mt-3 space-y-0.5">
      <li v-for="item in items" :key="item.id" class="group flex items-center gap-2">
        <button
          class="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg py-1.5 text-left"
          role="checkbox"
          :aria-checked="item.done"
          @click="emit('toggle', item)"
        >
          <span
            class="grid size-5 shrink-0 place-items-center rounded-md border transition-colors"
            :class="item.done ? 'border-accent bg-accent text-accent-fg' : 'border-border-strong'"
          >
            <Check v-if="item.done" class="size-3.5" :stroke-width="3" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm" :class="item.done ? 'text-faint line-through' : ''">
              {{ item.text }}
            </span>
            <span v-if="nameOf && item.done" class="block text-[10px] text-faint">
              {{ t('tools.doneBy', { name: nameOf(item.updatedBy) }) }}
            </span>
          </span>
        </button>
        <button
          class="grid size-7 shrink-0 place-items-center rounded-full text-faint transition-colors hover:bg-negative-soft hover:text-negative"
          :aria-label="t('common.delete')"
          @click="emit('remove', item)"
        >
          <X class="size-3.5" />
        </button>
      </li>
    </ul>

    <button
      v-else-if="presetLabel"
      class="mt-3 w-full rounded-lg border border-dashed border-border py-2 text-xs text-muted transition-colors hover:border-accent hover:text-accent"
      @click="emit('preset')"
    >
      {{ presetLabel }}
    </button>

    <form class="mt-3 flex gap-2" @submit.prevent="submit">
      <input
        v-model="draft"
        maxlength="120"
        :placeholder="t('tools.addPlaceholder')"
        class="h-9 min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 text-sm placeholder:text-faint focus:border-accent focus:outline-none"
      />
      <button
        type="submit"
        class="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted transition-colors hover:text-accent disabled:opacity-40"
        :disabled="!draft.trim()"
        :aria-label="t('tools.add')"
      >
        <Plus class="size-4" />
      </button>
    </form>
  </section>
</template>
