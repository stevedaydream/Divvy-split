<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Clock, LifeBuoy } from 'lucide-vue-next'

/** Quota state for an AI feature: paused until reset, or finished by the fallback. */
defineProps<{
  kind: 'blocked' | 'fallback'
  /** Formatted reset time, e.g. "15:00". */
  time: string
}>()

const { t } = useI18n()
</script>

<template>
  <p
    v-if="kind === 'fallback'"
    class="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs leading-relaxed"
    role="status"
  >
    <LifeBuoy class="mt-0.5 size-3.5 shrink-0 text-amber-500" />
    {{ t('ai.fallbackUsed', { time }) }}
  </p>
  <p v-else class="flex items-start gap-2 rounded-xl bg-surface-2 p-3 text-xs leading-relaxed text-muted" role="status">
    <Clock class="mt-0.5 size-3.5 shrink-0" />
    {{ t('ai.quotaBlocked', { time }) }}
  </p>
</template>
