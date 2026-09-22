<script setup lang="ts">
import { ChevronLeft } from 'lucide-vue-next'
import { useRouter } from 'vue-router'

withDefaults(defineProps<{ title?: string; back?: boolean; subtitle?: string }>(), { back: false })

const router = useRouter()

function goBack(): void {
  if (window.history.state?.back) router.back()
  else router.push('/groups')
}
</script>

<template>
  <header
    class="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur-lg pt-[env(safe-area-inset-top)]"
  >
    <div class="flex h-14 items-center gap-1 px-2">
      <button
        v-if="back"
        class="grid size-9 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-fg"
        aria-label="Back"
        @click="goBack"
      >
        <ChevronLeft class="size-5" />
      </button>

      <div class="min-w-0 flex-1" :class="back ? '' : 'px-2'">
        <h1 class="truncate text-base font-semibold">{{ title }}</h1>
        <p v-if="subtitle" class="truncate text-xs text-muted">{{ subtitle }}</p>
      </div>

      <div class="flex shrink-0 items-center gap-1 pr-1">
        <slot name="actions" />
      </div>
    </div>
  </header>
</template>
