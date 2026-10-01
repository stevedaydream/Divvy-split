<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Plus, Trash2 } from 'lucide-vue-next'
import AppInput from '@/components/ui/AppInput.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { MAX_EXPENSE_ITEMS, type ExpenseItemInput } from '@/lib/expenseItems'
import type { Group } from '@/types/models'

const props = defineProps<{ group: Group; uid: string }>()
const items = defineModel<ExpenseItemInput[]>({ required: true })
const { t } = useI18n()
let nextKey = Date.now()

function add(): void {
  items.value.push({ key: nextKey++, title: '', amount: '', payerId: props.uid, participantIds: [props.uid] })
}

function toggle(item: ExpenseItemInput, uid: string): void {
  item.participantIds = item.participantIds.includes(uid) ? item.participantIds.filter((id) => id !== uid) : [...item.participantIds, uid]
}
</script>

<template>
  <section class="space-y-3">
    <p class="text-xs leading-relaxed text-muted">{{ t('itemized.hint') }}</p>
    <article v-for="(item, index) in items" :key="item.key" class="space-y-3 rounded-xl border border-border bg-surface-2 p-3">
      <header class="flex items-center justify-between">
        <h3 class="text-xs font-medium text-muted">{{ t('itemized.item', { n: index + 1 }) }}</h3>
        <button type="button" class="grid size-8 place-items-center rounded-full text-muted hover:text-negative" :aria-label="t('itemized.removeItem', { n: index + 1 })" @click="items.splice(index, 1)">
          <Trash2 class="size-4" />
        </button>
      </header>
      <div class="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
        <AppInput v-model="item.title" maxlength="120" :aria-label="t('itemized.name')" :placeholder="t('itemized.name')" />
        <AppInput v-model="item.amount" inputmode="decimal" :aria-label="t('itemized.amount')" :placeholder="t('itemized.amount')" />
      </div>
      <label class="flex items-center gap-3 text-xs text-muted">
        {{ t('itemized.payer') }}
        <select v-model="item.payerId" class="h-9 min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 text-sm text-fg">
          <option v-for="uid in group.memberIds" :key="uid" :value="uid">{{ group.members[uid]?.nickname }}</option>
        </select>
      </label>
      <div class="flex items-center justify-between text-xs">
        <span class="font-medium text-muted">{{ t('group.splitWith') }}</span>
        <div class="flex gap-3">
          <button type="button" class="text-accent" @click="item.participantIds = [uid]">{{ t('group.justMe') }}</button>
          <button type="button" class="text-accent" @click="item.participantIds = [...group.memberIds]">{{ t('group.splitAll') }}</button>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <button v-for="uid in group.memberIds" :key="uid" type="button" class="rounded-lg border px-3 py-1.5 text-xs" :class="item.participantIds.includes(uid) ? 'border-accent bg-accent-soft text-accent' : 'border-border text-muted'" :aria-pressed="item.participantIds.includes(uid)" @click="toggle(item, uid)">
          {{ group.members[uid]?.nickname }}
        </button>
      </div>
    </article>
    <AppButton variant="secondary" block :disabled="items.length >= MAX_EXPENSE_ITEMS" @click="add">
      <template #icon><Plus class="size-4" /></template>{{ t('itemized.add') }}
    </AppButton>
    <p class="text-[11px] text-faint">{{ t('itemized.limit', { max: MAX_EXPENSE_ITEMS }) }}</p>
  </section>
</template>
