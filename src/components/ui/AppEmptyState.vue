<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{ icon?: Component; title: string; description?: string }>()
</script>

<template>
  <div class="flex flex-col items-center justify-center rounded-card border border-dashed border-border px-6 py-14 text-center">
    <component :is="icon" v-if="icon" class="mb-3 size-7 text-faint" :stroke-width="1.5" />
    <p class="text-sm font-medium text-fg">{{ title }}</p>
    <p v-if="description" class="mt-1 max-w-[28ch] text-xs leading-relaxed text-muted">
      {{ description }}
    </p>
    <div v-if="$slots.default" class="mt-5">
      <slot />
    </div>
  </div>
</template>
