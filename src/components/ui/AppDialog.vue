<script setup lang="ts">
import AppButton from './AppButton.vue'
import { useConfirm } from '@/composables/useConfirm'

const { pending, answer } = useConfirm()
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="pending"
        class="fixed inset-0 z-[70] grid place-items-center bg-overlay p-6 backdrop-blur-sm"
        @click.self="answer(false)"
      >
        <Transition name="pop" appear>
          <div
            role="alertdialog"
            aria-modal="true"
            class="w-full max-w-xs rounded-sheet border border-border bg-surface p-6 shadow-float"
          >
            <h2 class="text-base font-semibold">{{ pending.title }}</h2>
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
