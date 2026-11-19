<script lang="ts">
const stickersByTab = {
  itinerary: 'itinerary-map',
  ledger: 'ledger-entry',
  stats: 'stats-bars',
  tools: 'tools-packing',
  photos: 'photos-camera',
} as const

export type GroupTab = keyof typeof stickersByTab
const tabs = Object.keys(stickersByTab) as GroupTab[]
</script>

<script setup lang="ts">
import TripSticker from '@/components/ui/TripSticker.vue'

defineProps<{ active: GroupTab }>()
const emit = defineEmits<{ select: [tab: GroupTab] }>()
</script>

<template>
  <nav class="flex gap-1 px-3 sm:px-4" role="tablist" :aria-label="$t('groups.title')">
    <button
      v-for="option in tabs"
      :key="option"
      type="button"
      role="tab"
      class="ui-control relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-t-xl px-0.5 pb-2 pt-1 text-xs font-medium transition-colors sm:text-sm"
      :class="active === option ? 'bg-accent-soft font-bold text-fg' : 'text-muted hover:bg-surface-2 hover:text-fg'"
      :aria-selected="active === option"
      @click="emit('select', option)"
    >
      <TripSticker :pose="stickersByTab[option]" :size="36" />
      <span class="max-w-full break-words">{{ $t(`group.tabs.${option}`) }}</span>
      <span v-if="active === option" class="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent" aria-hidden="true" />
    </button>
  </nav>
</template>
