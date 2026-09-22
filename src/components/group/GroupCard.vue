<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { MapPin, MoreVertical, Users } from 'lucide-vue-next'
import { placeLabel } from '@/data/countries'
import type { Group } from '@/types/models'

const props = defineProps<{ group: Group }>()
const emit = defineEmits<{ open: []; options: [] }>()

const { locale } = useI18n()
const place = computed(() => placeLabel(props.group.location, props.group.destination, locale.value))
</script>

<template>
  <article
    class="flex items-center gap-3 rounded-card border border-border bg-surface p-4 shadow-card transition-colors hover:border-border-strong"
  >
    <button class="min-w-0 flex-1 text-left" @click="emit('open')">
      <h3 class="truncate text-sm font-semibold">{{ group.name }}</h3>

      <div class="mt-1.5 flex items-center gap-3 text-xs text-muted">
        <span v-if="place" class="flex min-w-0 items-center gap-1">
          <MapPin class="size-3.5 shrink-0" :stroke-width="1.75" />
          <span class="truncate">{{ place }}</span>
        </span>
        <span class="flex shrink-0 items-center gap-1">
          <Users class="size-3.5" :stroke-width="1.75" />
          {{ group.memberIds.length }}
        </span>
      </div>
    </button>

    <span class="shrink-0 rounded-md bg-surface-2 px-2 py-1 text-[11px] font-medium text-muted">
      {{ group.currency }}
    </span>

    <!-- An explicit affordance. The old build hid edit and delete behind a
         600 ms long-press with a hover-only hint that phones never showed. -->
    <button
      class="grid size-8 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-fg"
      :aria-label="$t('groups.options')"
      @click="emit('options')"
    >
      <MoreVertical class="size-4" />
    </button>
  </article>
</template>
