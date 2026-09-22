<script setup lang="ts">
import { computed, onMounted, ref, toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { Link2, Plus, Receipt, Scale } from 'lucide-vue-next'
import AppShell from '@/components/layout/AppShell.vue'
import TopBar from '@/components/layout/TopBar.vue'
import AppEmptyState from '@/components/ui/AppEmptyState.vue'
import AppSkeleton from '@/components/ui/AppSkeleton.vue'
import EntryRow from '@/components/group/EntryRow.vue'
import EntrySheet from '@/components/group/EntrySheet.vue'
import MemberStrip from '@/components/group/MemberStrip.vue'
import SettlementSheet from '@/components/group/SettlementSheet.vue'
import { useGroupDetail } from '@/composables/useGroupDetail'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { createEntry, deleteEntry, updateEntry, type EntryDraft } from '@/services/entries'
import { formatNumber } from '@/lib/money'
import { useAuthStore } from '@/stores/auth'
import { useRatesStore } from '@/stores/rates'
import type { Entry, Transfer } from '@/types/models'

const props = defineProps<{ id: string }>()

const { t, locale } = useI18n()
const auth = useAuthStore()
const rates = useRatesStore()
const toast = useToast()
const { confirm } = useConfirm()

const { group, entries, balances, settlements, total, loading } = useGroupDetail(toRef(props, 'id'))

const selectedMember = ref('all')
const entrySheetOpen = ref(false)
const settleSheetOpen = ref(false)
const editingEntry = ref<Entry | null>(null)
const presetSettlement = ref<{ to: string; amountMinor: number } | null>(null)

onMounted(() => {
  void rates.load()
})

const visibleEntries = computed(() =>
  selectedMember.value === 'all'
    ? entries.value
    : entries.value.filter((entry) => entry.payerId === selectedMember.value),
)

function openAdd(): void {
  editingEntry.value = null
  presetSettlement.value = null
  entrySheetOpen.value = true
}

function openEdit(entry: Entry): void {
  editingEntry.value = entry
  presetSettlement.value = null
  entrySheetOpen.value = true
}

function recordTransfer(transfer: Transfer): void {
  settleSheetOpen.value = false
  editingEntry.value = null
  presetSettlement.value = { to: transfer.to, amountMinor: transfer.amountMinor }
  entrySheetOpen.value = true
}

async function save(draft: EntryDraft): Promise<void> {
  const uid = auth.uid
  if (!uid) return

  try {
    if (editingEntry.value) await updateEntry(editingEntry.value.id, draft)
    else await createEntry(draft, uid)

    entrySheetOpen.value = false
    toast.success(t('group.saved'))
  } catch {
    toast.error(t('common.somethingWrong'))
  }
}

async function remove(entry: Entry): Promise<void> {
  const confirmed = await confirm({
    title: t('group.deleteTitle'),
    message: t('group.deleteMessage'),
    confirmLabel: t('common.delete'),
    tone: 'danger',
  })
  if (!confirmed) return

  try {
    await deleteEntry(entry.id)
    toast.success(t('group.deleted'))
  } catch {
    toast.error(t('common.somethingWrong'))
  }
}

async function copyInvite(): Promise<void> {
  const current = group.value
  if (!current) return

  const url = `${window.location.origin}/join?g=${current.id}&c=${current.inviteCode}`
  try {
    await navigator.clipboard.writeText(url)
    toast.success(t('invite.copied'))
  } catch {
    toast.info(t('invite.copyFailed', { url }))
  }
}
</script>

<template>
  <AppShell>
    <TopBar :title="group?.name" :subtitle="group?.location || undefined" back>
      <template #actions>
        <button
          class="grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          :aria-label="$t('invite.copy')"
          @click="copyInvite"
        >
          <Link2 class="size-4" />
        </button>
        <button
          class="grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          :aria-label="$t('settle.title')"
          @click="settleSheetOpen = true"
        >
          <Scale class="size-4" />
        </button>
      </template>
    </TopBar>

    <div v-if="loading" class="px-5 py-6">
      <AppSkeleton :rows="1" height="h-24" />
      <div class="mt-6"><AppSkeleton :rows="4" height="h-16" /></div>
    </div>

    <template v-else-if="group">
      <section class="px-5 pb-5 pt-6 text-center">
        <p class="text-xs font-medium text-muted">{{ $t('group.total') }}</p>
        <p class="tabular mt-1 text-3xl font-semibold tracking-tight">
          {{ formatNumber(total, group.currency, locale) }}
          <span class="text-base font-normal text-muted">{{ group.currency }}</span>
        </p>
      </section>

      <section class="px-5 pb-6">
        <MemberStrip
          :group="group"
          :balances="balances"
          :selected="selectedMember"
          :currency="group.currency"
          :locale="locale"
          @select="selectedMember = $event"
        />
      </section>

      <section class="px-5 pb-5">
        <h2 class="mb-3 text-xs font-medium text-muted">{{ $t('group.ledger') }}</h2>

        <AppEmptyState
          v-if="!visibleEntries.length"
          :icon="Receipt"
          :title="$t('group.noEntries')"
          :description="$t('group.noEntriesHint')"
        />

        <TransitionGroup v-else name="list" tag="div" class="relative space-y-2.5">
          <EntryRow
            v-for="entry in visibleEntries"
            :key="entry.id"
            :entry="entry"
            :group="group"
            :currency="group.currency"
            :locale="locale"
            :can-edit="entry.createdBy === auth.uid"
            @edit="openEdit(entry)"
            @remove="remove(entry)"
          />
        </TransitionGroup>
      </section>

      <button
        class="fixed bottom-6 right-5 z-30 grid size-13 place-items-center rounded-full bg-accent text-accent-fg shadow-float transition-transform active:scale-95"
        :aria-label="$t('group.addExpense')"
        @click="openAdd"
      >
        <Plus class="size-6" />
      </button>

      <EntrySheet
        :open="entrySheetOpen"
        :group="group"
        :uid="auth.uid ?? ''"
        :entry="editingEntry"
        :preset-settlement="presetSettlement"
        :locale="locale"
        @close="entrySheetOpen = false"
        @save="save"
      />

      <SettlementSheet
        :open="settleSheetOpen"
        :group="group"
        :transfers="settlements"
        :uid="auth.uid ?? ''"
        :currency="group.currency"
        :locale="locale"
        @close="settleSheetOpen = false"
        @record="recordTransfer"
      />
    </template>
  </AppShell>
</template>
