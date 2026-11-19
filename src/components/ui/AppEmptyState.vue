<script setup lang="ts">
import type { Component } from 'vue'
import TigerMascot from './TigerMascot.vue'

defineProps<{ icon?: Component; title: string; description?: string; mascot?: boolean }>()
</script>

<template>
  <div class="flex flex-col items-center justify-center rounded-card border-2 border-dashed border-border px-6 py-14 text-center">
    <div v-if="$slots.illustration" class="mb-3"><slot name="illustration" /></div>
    <TigerMascot v-else-if="mascot" :size="112" class="mb-3" />
    <component :is="icon" v-else-if="icon" class="mb-3 size-7 text-faint" :stroke-width="1.5" />
    <p class="text-lg font-semibold text-fg">{{ title }}</p>
    <p v-if="description" class="mt-1 max-w-[28ch] text-sm leading-relaxed text-muted">
      {{ description }}
    </p>
    <div v-if="$slots.default" class="mt-5">
      <slot />
    </div>
  </div>
</template>
