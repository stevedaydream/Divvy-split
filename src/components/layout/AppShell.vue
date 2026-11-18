<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import BottomNav from './BottomNav.vue'

defineProps<{ nav?: boolean }>()
const viewportHeight = ref(window.innerHeight)
function updateViewport() {
  viewportHeight.value = Math.min(window.innerHeight, window.visualViewport?.height ?? window.innerHeight)
}
onMounted(() => {
  updateViewport()
  window.addEventListener('resize', updateViewport)
  window.visualViewport?.addEventListener('resize', updateViewport)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', updateViewport)
  window.visualViewport?.removeEventListener('resize', updateViewport)
})
</script>

<template>
  <div class="app-shell mx-auto min-h-dvh w-full max-w-md" :style="{ '--app-viewport-height': `${viewportHeight}px` }" :class="nav ? 'pb-28' : ''">
    <slot />
    <BottomNav v-if="nav" />
  </div>
</template>
