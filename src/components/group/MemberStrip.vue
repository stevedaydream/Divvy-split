<script setup lang="ts">
import { UserPlus } from 'lucide-vue-next'
import AppAvatar from '@/components/ui/AppAvatar.vue'
import { isGuestId } from '@/lib/guests'
import { formatNumber } from '@/lib/money'
import type { Balances } from '@/lib/settlement'
import type { CurrencyCode } from '@/types/currency'
import type { Group } from '@/types/models'

const props = defineProps<{
  group: Group
  balances: Balances
  selected: string
  currency: CurrencyCode
  locale: string
  /** Shows the button that opens guest management. */
  canManage?: boolean
}>()

const emit = defineEmits<{ select: [uid: string]; manage: [] }>()

function nameOf(uid: string): string {
  return props.group.members[uid]?.nickname ?? '?'
}

function balanceOf(uid: string): number {
  return props.balances[uid] ?? 0
}
</script>

<template>
  <!-- pt-1 leaves room for the active avatar's ring + offset, which
       overflow-x-auto would otherwise clip at the top. -->
  <div class="no-scrollbar -mx-5 flex gap-4 overflow-x-auto px-5 pt-1 pb-1">
    <button
      class="flex w-16 shrink-0 flex-col items-center gap-1.5"
      @click="emit('select', 'all')"
    >
      <AppAvatar :name="$t('group.everyone')" :active="selected === 'all'" />
      <span class="truncate text-[11px] text-muted">{{ $t('group.everyone') }}</span>
    </button>

    <button
      v-for="uid in group.ledgerIds"
      :key="uid"
      class="flex w-16 shrink-0 flex-col items-center gap-1.5"
      @click="emit('select', uid)"
    >
      <AppAvatar :name="nameOf(uid)" :active="selected === uid" />
      <span class="w-full truncate text-center text-[11px] text-muted">{{ nameOf(uid) }}</span>
      <span v-if="isGuestId(uid)" class="-mt-1 text-[10px] text-faint">{{ $t('guest.badge') }}</span>
      <span
        v-if="balanceOf(uid) !== 0"
        class="tabular text-[11px] font-medium"
        :class="balanceOf(uid) > 0 ? 'text-positive' : 'text-negative'"
      >
        {{ balanceOf(uid) > 0 ? '+' : '−'
        }}{{ formatNumber(Math.abs(balanceOf(uid)), currency, locale) }}
      </span>
    </button>

    <button
      v-if="canManage"
      class="flex w-16 shrink-0 flex-col items-center gap-1.5"
      :aria-label="$t('guest.title')"
      @click="emit('manage')"
    >
      <span class="grid size-10 place-items-center rounded-full border border-dashed border-border-strong text-muted">
        <UserPlus class="size-4" />
      </span>
      <span class="w-full truncate text-center text-[11px] text-muted">{{ $t('guest.short') }}</span>
    </button>
  </div>
</template>
