<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref, watch } from 'vue'
import { Image } from 'lucide-vue-next'
import type { LocalPhoto, PhotoInfo, SharedPhoto } from '@/types/photos'
import { driveConnected, readDrivePhoto } from '@/services/photoDrive'

const props = defineProps<{ photo: PhotoInfo; selected: boolean; saved: boolean; savedLabel: string; missingLabel: string; savedBlob?: Blob; thumbnailId?: string }>()
defineEmits<{ select: []; preview: [] }>()
const url = ref('')
const local = computed(() => props.savedBlob ?? (props.photo as LocalPhoto).blob)
const root = ref<HTMLElement>()
const inView = ref(false)
let observer: IntersectionObserver | undefined
let generation = 0
watch(local, (blob) => { if (url.value) URL.revokeObjectURL(url.value); url.value = blob ? URL.createObjectURL(blob) : '' }, { immediate: true })
const accessRevision = ref(0)
const accessChanged = () => { accessRevision.value++ }
window.addEventListener('divvy:drive-access', accessChanged)
watch([inView, driveConnected, () => props.thumbnailId, local, accessRevision], async () => {
  const ticket = ++generation
  if (!inView.value || !driveConnected.value || !props.thumbnailId || local.value) return
  try {
    let blob: Blob
    try { blob = await readDrivePhoto(props.thumbnailId, 200000) }
    catch {
      if (props.photo.size > 200000 || !('driveFileId' in props.photo)) return
      blob = await readDrivePhoto((props.photo as SharedPhoto).driveFileId, 200000)
    }
    if (ticket !== generation || blob.size > 200000 || !blob.type.startsWith('image/')) return
    if (url.value) URL.revokeObjectURL(url.value)
    url.value = URL.createObjectURL(blob)
  } catch { /* 授權或連線不足時保留預覽入口，完整圖片由使用者點開。 */ }
})
onMounted(() => { observer = new IntersectionObserver((entries) => { inView.value = entries.some((entry) => entry.isIntersecting) }, { rootMargin: '200px' }); if (root.value) observer.observe(root.value) })
onScopeDispose(() => { generation++; observer?.disconnect(); window.removeEventListener('divvy:drive-access', accessChanged); if (url.value) URL.revokeObjectURL(url.value) })
</script>

<template>
  <article ref="root" class="overflow-hidden rounded-xl border bg-surface" :class="selected ? 'border-accent ring-1 ring-accent' : 'border-border'">
    <button type="button" class="relative grid aspect-square w-full place-items-center bg-surface-2" :aria-label="photo.name" @click="$emit('preview')">
      <img v-if="url" :src="url" :alt="photo.name" loading="lazy" class="h-full w-full object-cover" @error="url = ''" />
      <Image v-else class="size-8 text-faint" />
    </button>
    <label class="flex cursor-pointer items-start gap-2 p-2 text-xs">
      <input type="checkbox" class="mt-0.5 size-4 shrink-0 accent-accent" :checked="selected" :aria-label="photo.name" @change="$emit('select')" />
      <span class="min-w-0"><span class="block truncate font-medium">{{ photo.name }}</span><span class="block truncate text-muted">{{ photo.uploaderName }}</span><span class="mt-1 block" :class="saved ? 'text-positive' : 'text-muted'">{{ saved ? savedLabel : missingLabel }}</span></span>
    </label>
    <slot />
  </article>
</template>
