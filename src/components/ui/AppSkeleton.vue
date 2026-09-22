<script setup lang="ts">
withDefaults(defineProps<{ rows?: number; height?: string }>(), { rows: 3, height: 'h-20' })
</script>

<template>
  <div class="space-y-3" aria-hidden="true">
    <div
      v-for="row in rows"
      :key="row"
      class="animate-pulse rounded-card bg-surface-2"
      :class="height"
    />
  </div>
</template>
