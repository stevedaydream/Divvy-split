<script setup lang="ts">
import { ArrowRight, PartyPopper } from 'lucide-vue-next'
import AppAvatar from '@/components/ui/AppAvatar.vue'
import AppEmptyState from '@/components/ui/AppEmptyState.vue'
import AppSheet from '@/components/ui/AppSheet.vue'
import { formatNumber } from '@/lib/money'
import { isGuestId } from '@/lib/guests'
import type { CurrencyCode } from '@/types/currency'
import type { Group, Transfer } from '@/types/models'

const props = defineProps<{
  open: boolean
  group: Group
  transfers: Transfer[]
  uid: string
  currency: CurrencyCode
  locale: string
}>()

const emit = defineEmits<{ close: []; record: [transfer: Transfer] }>()

/** The payer, the recipient, or anyone on behalf of a guest may record a transfer. */
function canRecord(transfer: Transfer): boolean {
  return transfer.from === props.uid || transfer.to === props.uid || isGuestId(transfer.from) || isGuestId(transfer.to)
}

function nameOf(id: string): string {
  return props.group.members[id]?.nickname ?? '?'
}
</script>

<template>
  <AppSheet :open="open" :title="$t('settle.title')" @close="emit('close')">
    <p class="-mt-1 mb-5 text-xs leading-relaxed text-muted">{{ $t('settle.subtitle') }}</p>

    <AppEmptyState
      v-if="!transfers.length"
      :icon="PartyPopper"
      :title="$t('settle.allSettled')"
      :description="$t('settle.allSettledHint')"
    />

    <ul v-else class="space-y-2">
      <li v-for="(transfer, index) in transfers" :key="index">
        <button
          class="flex w-full items-center gap-3 rounded-card border p-3.5 text-left transition-colors"
          :class="
            transfer.from === uid || transfer.to === uid
              ? 'border-accent/40 bg-accent-soft/40 hover:border-accent'
              : 'border-border hover:border-border-strong'
          "
          :disabled="!canRecord(transfer)"
          @click="emit('record', transfer)"
        >
          <span class="flex shrink-0 -space-x-2">
            <AppAvatar :name="nameOf(transfer.from)" size="sm" />
            <AppAvatar :name="nameOf(transfer.to)" size="sm" />
          </span>

          <span class="min-w-0 flex-1">
            <span class="flex items-center gap-1 text-xs text-muted">
              <span class="truncate">{{ nameOf(transfer.from) }}</span>
              <ArrowRight class="size-3 shrink-0" />
              <span class="truncate">{{ nameOf(transfer.to) }}</span>
            </span>
            <span class="tabular mt-0.5 block text-sm font-semibold">
              {{ formatNumber(transfer.amountMinor, currency, locale) }}
            </span>
          </span>

          <span
            v-if="transfer.from === uid"
            class="shrink-0 rounded-full bg-accent px-2.5 py-1 text-[11px] font-medium text-accent-fg"
          >
            {{ $t('settle.youPay') }}
          </span>
          <span
            v-else-if="transfer.to === uid"
            class="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-positive"
          >
            {{ $t('settle.youReceive') }}
          </span>
          <span
            v-else-if="canRecord(transfer)"
            class="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-muted"
          >
            {{ $t('settle.recordIt') }}
          </span>
        </button>
      </li>
    </ul>
  </AppSheet>
</template>
