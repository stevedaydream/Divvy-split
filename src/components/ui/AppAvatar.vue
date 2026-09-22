<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{ name: string; size?: 'sm' | 'md' | 'lg'; active?: boolean }>(),
  { size: 'md' },
)

const SIZES = { sm: 'size-7 text-[11px]', md: 'size-10 text-sm', lg: 'size-14 text-lg' } as const

const initial = computed(() => props.name.trim().charAt(0).toUpperCase() || '?')

/** A stable hue per name, so the same person keeps the same tint everywhere. */
const hue = computed(() => {
  let hash = 0
  for (const char of props.name) hash = (hash * 31 + char.charCodeAt(0)) % 360
  return hash
})
</script>

<template>
  <span
    class="grid shrink-0 place-items-center rounded-full font-semibold transition-all"
    :class="[SIZES[size], active ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg' : '']"
    :style="{
      backgroundColor: `oklch(var(--avatar-bg) ${hue})`,
      color: `oklch(var(--avatar-fg) ${hue})`,
    }"
  >
    {{ initial }}
  </span>
</template>
