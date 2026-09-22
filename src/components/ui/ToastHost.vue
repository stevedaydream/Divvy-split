<script setup lang="ts">
import { CheckCircle2, CircleAlert, Info } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'

const { toasts, dismiss } = useToast()

const ICONS = { info: Info, success: CheckCircle2, error: CircleAlert }
const TONES = {
  info: 'text-fg',
  success: 'text-positive',
  error: 'text-negative',
}
</script>

<template>
  <Teleport to="body">
    <div
      class="pointer-events-none fixed inset-x-0 top-0 z-[80] flex flex-col items-center gap-2 p-4 pt-[max(1rem,env(safe-area-inset-top))]"
      role="status"
      aria-live="polite"
    >
      <TransitionGroup name="list">
        <button
          v-for="toast in toasts"
          :key="toast.id"
          class="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-left shadow-float"
          @click="dismiss(toast.id)"
        >
          <component :is="ICONS[toast.tone]" class="mt-0.5 size-4 shrink-0" :class="TONES[toast.tone]" />
          <span class="text-sm leading-snug">{{ toast.message }}</span>
        </button>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
