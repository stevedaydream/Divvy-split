<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowLeftRight, Pencil, Trash2 } from 'lucide-vue-next'
import { categoryEmoji } from '@/data/categories'
import { formatNumber } from '@/lib/money'
import type { CurrencyCode } from '@/types/currency'
import type { Entry, Group } from '@/types/models'
import { expensePayments } from '@/lib/expenseItems'
import { expenseShares } from '@/lib/settlement'

const props = defineProps<{
  entry: Entry
  group: Group
  currency: CurrencyCode
  locale: string
  canEdit: boolean
}>()

defineEmits<{ edit: []; remove: [] }>()

const isSettlement = computed(() => props.entry.type === 'settlement')
const expanded = ref(false)
const itemized = computed(() => !!props.entry.items?.length)
const names = (ids: string[]) => ids.map((id) => props.group.members[id]?.nickname ?? '?').join('、')
const summary = computed(() => {
  const paid = expensePayments(props.entry)
  const shares = expenseShares(props.entry, new Set(props.group.memberIds))
  return props.group.memberIds.filter((uid) => shares[uid] || paid[uid]).map((uid) => ({ uid, share: shares[uid] ?? 0, paid: paid[uid] ?? 0 }))
})

const subtitle = computed(() => {
  if (itemized.value) return names([...new Set(props.entry.items!.map((item) => item.payerId))])
  const uid = isSettlement.value ? props.entry.participantIds[0] : props.entry.payerId
  return props.group.members[uid ?? '']?.nickname ?? '?'
})

/** Only shown when it differs from the group currency — otherwise it is noise. */
const showOriginal = computed(() => props.entry.currency !== props.currency)
</script>

<template>
  <article class="rounded-card border border-border bg-surface p-4 shadow-card">
    <div class="flex items-center gap-3">
    <span
      class="grid size-9 shrink-0 place-items-center rounded-full"
      :class="isSettlement ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-muted'"
    >
      <ArrowLeftRight v-if="isSettlement" class="size-4" :stroke-width="1.75" />
      <span v-else class="text-base" role="img" :aria-label="$t(`category.${entry.category}`)">
        {{ categoryEmoji(entry.category) }}
      </span>
    </span>

    <div class="min-w-0 flex-1">
      <h3 class="truncate text-sm font-medium">
        {{ isSettlement ? $t('group.settlement') : entry.title }}
      </h3>
      <p class="truncate text-xs text-muted">
        {{ isSettlement
          ? $t('group.transferTo', { name: subtitle })
          : $t('group.paidBy', { name: subtitle }) }}
        <template v-if="entry.method === 'linepay'">
          · {{ showOriginal ? $t('line.tagConverted') : 'LINE Pay' }}
        </template>
        <template v-if="!isSettlement && entry.note"> · {{ entry.note }}</template>
      </p>
      <button v-if="itemized" type="button" class="mt-1 text-xs text-accent" :aria-expanded="expanded" @click="expanded = !expanded">
        {{ $t(expanded ? 'itemized.collapse' : 'itemized.expand', { count: entry.items!.length }) }}
      </button>
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
    </div>
    <section v-if="expanded && itemized" class="mt-3 space-y-2 border-t border-border pt-3">
      <div v-for="(item, index) in entry.items" :key="index" class="text-xs">
        <div class="flex justify-between gap-3"><span class="min-w-0 break-words">{{ item.title }}</span><span class="tabular shrink-0">{{ formatNumber(item.amountMinor, entry.currency, locale) }} {{ entry.currency }}</span></div>
        <p class="mt-0.5 text-faint">{{ $t('group.paidBy', { name: names([item.payerId]) }) }} · {{ $t('itemized.splitNames', { names: names(item.participantIds) }) }}</p>
      </div>
      <div class="space-y-1 border-t border-border pt-2 text-xs">
        <p class="text-muted">{{ $t('itemized.summary') }} · {{ currency }}</p>
        <div v-for="person in summary" :key="person.uid" class="flex justify-between gap-3"><span>{{ names([person.uid]) }}</span><span class="tabular text-muted">{{ $t('itemized.personSummary', { share: formatNumber(person.share, currency, locale), paid: formatNumber(person.paid, currency, locale) }) }}</span></div>
      </div>
    </section>
  </article>
</template>
