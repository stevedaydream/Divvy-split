<script setup lang="ts">
import AppAvatar from '@/components/ui/AppAvatar.vue'
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
}>()

const emit = defineEmits<{ select: [uid: string] }>()

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
      v-for="uid in group.memberIds"
      :key="uid"
      class="flex w-16 shrink-0 flex-col items-center gap-1.5"
      @click="emit('select', uid)"
    >
      <AppAvatar :name="nameOf(uid)" :active="selected === uid" />
      <span class="w-full truncate text-center text-[11px] text-muted">{{ nameOf(uid) }}</span>
      <span
        v-if="balanceOf(uid) !== 0"
        class="tabular text-[11px] font-medium"
        :class="balanceOf(uid) > 0 ? 'text-positive' : 'text-negative'"
      >
        {{ balanceOf(uid) > 0 ? '+' : '−'
        }}{{ formatNumber(Math.abs(balanceOf(uid)), currency, locale) }}
      </span>
    </button>
  </div>
</template>
