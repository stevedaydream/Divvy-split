<script setup lang="ts">
import { onMounted } from 'vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import ToastHost from '@/components/ui/ToastHost.vue'
import { currentLocale } from '@/i18n'

onMounted(() => {
  document.documentElement.lang = currentLocale()
})
</script>

<template>
  <RouterView v-slot="{ Component }">
    <Transition name="fade" mode="out-in">
      <component :is="Component" />
    </Transition>
  </RouterView>

  <ToastHost />
  <AppDialog />
</template>
