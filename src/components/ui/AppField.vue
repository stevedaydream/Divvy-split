<script setup lang="ts">
defineProps<{ label: string; hint?: string; for?: string }>()
</script>

<template>
  <div class="space-y-1.5">
    <label :for="$props.for" class="block text-sm font-semibold text-muted">
      {{ label }}
    </label>
    <slot />
    <p v-if="hint" class="text-sm text-faint">{{ hint }}</p>
  </div>
</template>
