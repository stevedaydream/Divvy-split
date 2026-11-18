<script setup lang="ts">
import { ref, useId } from 'vue'
import { useModalFocus } from '@/composables/useModalFocus'
import AppButton from './AppButton.vue'
import { useConfirm } from '@/composables/useConfirm'

const { pending, answer } = useConfirm()
const panel = ref<HTMLElement | null>(null)
const titleId = useId()
useModalFocus(() => !!pending.value, panel, () => answer(false))
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="pending"
        class="fixed inset-0 z-[70] grid place-items-center bg-overlay p-6 "
        @click.self="answer(false)"
      >
        <Transition name="pop" appear>
          <div
            ref="panel"
            tabindex="-1"
            :aria-labelledby="titleId"
            role="alertdialog"
            aria-modal="true"
            class="w-full max-w-xs rounded-sheet border-[3px] border-border-strong bg-surface p-6 shadow-float"
          >
            <h2 :id="titleId" class="text-xl font-bold">{{ pending.title }}</h2>
            <p v-if="pending.message" class="mt-2 text-sm leading-relaxed text-muted">
              {{ pending.message }}
            </p>

            <div class="mt-6 grid grid-cols-2 gap-3">
              <AppButton variant="secondary" @click="answer(false)">
                {{ pending.cancelLabel ?? 'Cancel' }}
              </AppButton>
              <AppButton
                :variant="pending.tone === 'danger' ? 'danger' : 'primary'"
                @click="answer(true)"
              >
                {{ pending.confirmLabel ?? 'OK' }}
              </AppButton>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
