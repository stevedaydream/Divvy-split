<script setup lang="ts">
import welcome from '@/assets/mascot/tiger-welcome.svg'
import map from '@/assets/mascot/tiger-map.svg'
withDefaults(defineProps<{ pose?: 'welcome' | 'map'; size?: number }>(), { pose: 'welcome', size: 112 })
</script>
<template>
  <img :src="pose === 'map' ? map : welcome" alt="" aria-hidden="true" class="tiger-mascot" :width="size" :height="size" />
</template>
