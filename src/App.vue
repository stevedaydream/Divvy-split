<script setup lang="ts">
import { onMounted, onScopeDispose, watch } from 'vue'
import { runPhotoBackup } from '@/composables/usePhotoBackup'
import { driveConnected } from '@/services/photoDrive'
import AppDialog from '@/components/ui/AppDialog.vue'
import ToastHost from '@/components/ui/ToastHost.vue'
import { currentLocale } from '@/i18n'

onMounted(() => {
  document.documentElement.lang = currentLocale()
})
const backup = () => { if (navigator.onLine && driveConnected.value) void runPhotoBackup() }
watch(driveConnected, backup)
window.addEventListener('divvy:photos', backup)
window.addEventListener('online', backup)
const backupTimer = setInterval(backup, 60000)
onScopeDispose(() => { clearInterval(backupTimer); window.removeEventListener('divvy:photos', backup); window.removeEventListener('online', backup) })
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
