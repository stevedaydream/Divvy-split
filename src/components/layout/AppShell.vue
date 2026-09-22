<script setup lang="ts">
import BottomNav from './BottomNav.vue'

defineProps<{ nav?: boolean }>()
</script>

<template>
  <div class="mx-auto min-h-dvh w-full max-w-md" :class="nav ? 'pb-24' : ''">
    <slot />
    <BottomNav v-if="nav" />
  </div>
</template>
