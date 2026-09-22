<script setup lang="ts">
import { computed } from 'vue'
import { ArrowLeftRight, Pencil, Receipt, Trash2 } from 'lucide-vue-next'
import { formatNumber } from '@/lib/money'
import type { CurrencyCode } from '@/types/currency'
import type { Entry, Group } from '@/types/models'

const props = defineProps<{
  entry: Entry
  group: Group
  currency: CurrencyCode
  locale: string
  canEdit: boolean
}>()

defineEmits<{ edit: []; remove: [] }>()

const isSettlement = computed(() => props.entry.type === 'settlement')

const subtitle = computed(() => {
  const uid = isSettlement.value ? props.entry.participantIds[0] : props.entry.payerId
  return props.group.members[uid ?? '']?.nickname ?? '?'
})

/** Only shown when it differs from the group currency — otherwise it is noise. */
const showOriginal = computed(() => props.entry.currency !== props.currency)
</script>

<template>
  <article class="flex items-center gap-3 rounded-card border border-border bg-surface p-4 shadow-card">
    <span
      class="grid size-9 shrink-0 place-items-center rounded-full"
      :class="isSettlement ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-muted'"
    >
      <component :is="isSettlement ? ArrowLeftRight : Receipt" class="size-4" :stroke-width="1.75" />
    </span>

    <div class="min-w-0 flex-1">
      <h3 class="truncate text-sm font-medium">
        {{ isSettlement ? $t('group.settlement') : entry.title }}
      </h3>
      <p class="truncate text-xs text-muted">
        {{ isSettlement
          ? $t('group.transferTo', { name: subtitle })
          : $t('group.paidBy', { name: subtitle }) }}
      </p>
    </div>

    <div class="shrink-0 text-right">
      <p class="tabular text-sm font-semibold" :class="isSettlement ? 'text-accent' : ''">
        {{ formatNumber(entry.groupAmountMinor, currency, locale) }}
      </p>
      <p v-if="showOriginal" class="tabular text-[11px] text-faint">
        {{ entry.currency }} {{ formatNumber(entry.amountMinor, entry.currency, locale) }}
      </p>
    </div>

    <!-- Always visible on touch devices; the old build hid these behind
         `group-hover`, which a phone can never trigger. -->
    <div v-if="canEdit" class="flex shrink-0 gap-0.5">
      <button
        class="grid size-8 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-fg"
        :aria-label="$t('common.edit')"
        @click="$emit('edit')"
      >
        <Pencil class="size-3.5" />
      </button>
      <button
        class="grid size-8 place-items-center rounded-full text-muted transition-colors hover:bg-negative-soft hover:text-negative"
        :aria-label="$t('common.delete')"
        @click="$emit('remove')"
      >
        <Trash2 class="size-3.5" />
      </button>
    </div>
  </article>
</template>
