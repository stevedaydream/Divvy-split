<script setup lang="ts">
import { ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { useModalFocus } from '@/composables/useModalFocus'
import { X } from 'lucide-vue-next'

const props = defineProps<{ open: boolean; title?: string }>()
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const panel = ref<HTMLElement | null>(null)
const titleId = useId()
useModalFocus(() => props.open, panel, () => emit('close'))
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-end justify-center bg-overlay  sm:items-center sm:p-4"
        @click.self="emit('close')"
      >
        <Transition name="sheet" appear>
          <div
            ref="panel"
            tabindex="-1"
            :aria-labelledby="titleId"
            role="dialog"
            aria-modal="true"
            class="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-sheet border-t-[3px] border-border-strong bg-surface shadow-float sm:max-w-md sm:rounded-sheet sm:border-[3px]"
          >
            <div class="relative flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
              <div class="absolute inset-x-0 top-2 mx-auto h-1 w-10 rounded-full bg-border-strong sm:hidden" />
              <h2 :id="titleId" class="text-xl font-bold">{{ title }}</h2>
              <button
                class="ui-control -mr-1 grid size-8 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-fg"
                :aria-label="t('common.close')"
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
