<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import { X } from 'lucide-vue-next'

const props = defineProps<{ open: boolean; title?: string }>()
const emit = defineEmits<{ close: [] }>()

// A bottom sheet reaches the thumb; a centred modal does not. This replaces
// the seven hand-rolled modals the old screens each carried their own copy of.
function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') emit('close')
}

watch(
  () => props.open,
  (open) => {
    document.body.style.overflow = open ? 'hidden' : ''
    if (open) window.addEventListener('keydown', onKeydown)
    else window.removeEventListener('keydown', onKeydown)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  document.body.style.overflow = ''
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-end justify-center bg-overlay backdrop-blur-sm sm:items-center sm:p-4"
        @click.self="emit('close')"
      >
        <Transition name="sheet" appear>
          <div
            role="dialog"
            aria-modal="true"
            class="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-sheet border-t border-border bg-surface shadow-float sm:max-w-md sm:rounded-sheet sm:border"
          >
            <div class="relative flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
              <div class="absolute inset-x-0 top-2 mx-auto h-1 w-10 rounded-full bg-border-strong sm:hidden" />
              <h2 class="text-base font-semibold">{{ title }}</h2>
              <button
                class="-mr-1 grid size-8 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-fg"
                :aria-label="'Close'"
                @click="emit('close')"
              >
                <X class="size-4" />
              </button>
            </div>

            <div class="flex-1 overflow-y-auto overscroll-contain px-5 py-5">
              <slot />
            </div>

            <div v-if="$slots.footer" class="shrink-0 border-t border-border px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <slot name="footer" />
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
