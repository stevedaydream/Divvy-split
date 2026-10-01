<script setup lang="ts">
import { onScopeDispose, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGroupsStore } from '@/stores/groups'
import { useAuthStore } from '@/stores/auth'
import { photoExpiryReminders } from '@/services/sharedPhotos'
import { listLocalPhotos } from '@/services/localPhotos'
const store = useGroupsStore()
const auth = useAuthStore()
const { t } = useI18n()
const notices = ref<{ id: string; name: string; count: number }[]>([])
const checked = new Set<string>()
let generation = 0
watch(() => auth.uid, () => { generation++; checked.clear(); notices.value = [] })
watch(() => store.groups, async (groups) => {
  if (!auth.uid) return
  const ticket = generation
  let saved: Set<string>
  try { saved = new Set((await listLocalPhotos(auth.uid)).map((photo) => photo.id)) }
  catch { return }
  for (const group of groups) {
    if (checked.has(group.id)) continue
    checked.add(group.id)
    try {
      const photos = await photoExpiryReminders(group.id)
      const count = photos.filter((photo) => !saved.has(photo.id)).length
      if (ticket === generation && count) notices.value.push({ id: group.id, name: group.name, count })
    } catch { /* 既有揪團列表仍可正常使用，提醒於下次開啟重新查詢。 */ }
  }
}, { immediate: true })
onScopeDispose(() => { generation++ })
</script>
<template><div v-if="notices.length" class="mb-4 space-y-2"><RouterLink v-for="notice in notices" :key="notice.id" :to="{ name: 'group', params: { id: notice.id }, query: { tab: 'photos' } }" class="block rounded-xl border border-accent/30 bg-accent/5 p-3 text-xs text-accent">{{ t('photos.reminder', notice) }}</RouterLink></div></template>
