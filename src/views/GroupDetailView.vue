<script setup lang="ts">
import { computed, onMounted, ref, toRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { CircleCheck, HandCoins, Plus, Receipt, UserPlus } from 'lucide-vue-next'
import AppButton from '@/components/ui/AppButton.vue'
import AppShell from '@/components/layout/AppShell.vue'
import TopBar from '@/components/layout/TopBar.vue'
import AppEmptyState from '@/components/ui/AppEmptyState.vue'
import AppSkeleton from '@/components/ui/AppSkeleton.vue'
import EntryRow from '@/components/group/EntryRow.vue'
import EntrySheet from '@/components/group/EntrySheet.vue'
import AiGuideSheet from '@/components/group/AiGuideSheet.vue'
import GroupItinerary from '@/components/group/GroupItinerary.vue'
import GroupStats from '@/components/group/GroupStats.vue'
import GroupTools from '@/components/group/GroupTools.vue'
import InviteSheet from '@/components/group/InviteSheet.vue'
import ItinerarySheet from '@/components/group/ItinerarySheet.vue'
import MemberStrip from '@/components/group/MemberStrip.vue'
import SettlementSheet from '@/components/group/SettlementSheet.vue'
import { useGroupDetail } from '@/composables/useGroupDetail'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { createEntry, deleteEntry, updateEntry, type EntryDraft } from '@/services/entries'
import { updateGroup } from '@/services/groups'
import { createItem, deleteItem, updateItem, type ItineraryDraft } from '@/services/itinerary'
import { placeLabel } from '@/data/countries'
import { formatDay, todayIso } from '@/lib/dates'
import { defaultTab, hasTripDates, tripPhase } from '@/lib/itinerary'
import { formatNumber } from '@/lib/money'
import { useAuthStore } from '@/stores/auth'
import { useRatesStore } from '@/stores/rates'
import type { Entry, EntryCategory, ItineraryItem, ItineraryKind, Transfer } from '@/types/models'

const props = defineProps<{ id: string }>()

const { t, locale } = useI18n()
const auth = useAuthStore()
const rates = useRatesStore()
const toast = useToast()
const { confirm } = useConfirm()

const { group, entries, itinerary, balances, settlements, total, loading } = useGroupDetail(toRef(props, 'id'))

const selectedMember = ref('all')
const entrySheetOpen = ref(false)
const settleSheetOpen = ref(false)
const editingEntry = ref<Entry | null>(null)
const presetSettlement = ref<{ to: string; amountMinor: number } | null>(null)
const presetExpense = ref<{ title: string; date: string; category: EntryCategory } | null>(null)

onMounted(() => {
  void rates.load()
})

type GroupTab = 'itinerary' | 'ledger' | 'stats' | 'tools'
const TABS: GroupTab[] = ['itinerary', 'ledger', 'stats', 'tools']
const tab = ref<GroupTab>('ledger')

// Pick the opening tab from the trip phase once, when the group first loads;
// after that the tab only changes when the user taps one.
let tabChosen = false
watch(group, (next) => {
  if (tabChosen || !next) return
  tabChosen = true
  tab.value = defaultTab(tripPhase(next.startDate, next.endDate, todayIso()))
})

/** A group of one has nobody to settle with or filter by. */
const shared = computed(() => (group.value?.memberIds.length ?? 0) > 1)

/**
 * What the settle-up button says: debts still open, nothing ever owed, or
 * all square after some number of repayments.
 */
const settlementCount = computed(() => entries.value.filter((e) => e.type === 'settlement').length)
const settleState = computed<'pending' | 'none' | 'settled'>(() => {
  if (settlements.value.length) return 'pending'
  return settlementCount.value ? 'settled' : 'none'
})
const settleLabel = computed(() => {
  if (settleState.value === 'pending') return t('settle.actionPending', { count: settlements.value.length })
  if (settleState.value === 'settled') return t('settle.actionSettled', { count: settlementCount.value })
  return t('settle.actionNone')
})

const visibleEntries = computed(() =>
  selectedMember.value === 'all'
    ? entries.value
    : entries.value.filter((entry) => entry.payerId === selectedMember.value),
)

/** The ledger split into days, each with its spending subtotal. */
const entryDays = computed(() => {
  const days: { date: string; entries: Entry[]; subtotal: number }[] = []
  for (const entry of visibleEntries.value) {
    let day = days[days.length - 1]
    if (!day || day.date !== entry.date) {
      day = { date: entry.date, entries: [], subtotal: 0 }
      days.push(day)
    }
    day.entries.push(entry)
    if (entry.type === 'expense') day.subtotal += entry.groupAmountMinor
  }
  return days
})

function openAdd(): void {
  editingEntry.value = null
  presetSettlement.value = null
  presetExpense.value = null
  entrySheetOpen.value = true
}

function openEdit(entry: Entry): void {
  editingEntry.value = entry
  presetSettlement.value = null
  presetExpense.value = null
  entrySheetOpen.value = true
}

function recordTransfer(transfer: Transfer): void {
  settleSheetOpen.value = false
  editingEntry.value = null
  presetExpense.value = null
  presetSettlement.value = { to: transfer.to, amountMinor: transfer.amountMinor }
  entrySheetOpen.value = true
}

/** "Record" on a plan item: a new expense named after it, on its day. */
function recordItem(item: ItineraryItem): void {
  editingEntry.value = null
  presetSettlement.value = null
  presetExpense.value = { title: item.title, date: item.date, category: item.category }
  entrySheetOpen.value = true
}

// --- itinerary ---------------------------------------------------------------

const itemSheetOpen = ref(false)
const editingItem = ref<ItineraryItem | null>(null)
const itemDate = ref(todayIso())
const itemKind = ref<ItineraryKind>('spot')

/** New items land on today during the trip, otherwise on its first day. */
function defaultItemDate(): string {
  const current = group.value
  if (!current || !hasTripDates(current.startDate, current.endDate)) return todayIso()
  const today = todayIso()
  return today >= current.startDate && today <= current.endDate ? today : current.startDate
}

function openAddItem(date = defaultItemDate(), kind: ItineraryKind = 'spot'): void {
  editingItem.value = null
  itemDate.value = date
  itemKind.value = kind
  itemSheetOpen.value = true
}

function openEditItem(item: ItineraryItem): void {
  editingItem.value = item
  itemSheetOpen.value = true
}

async function saveItem(draft: ItineraryDraft): Promise<void> {
  const current = group.value
  const uid = auth.uid
  if (!current || !uid) return
  try {
    if (editingItem.value) await updateItem(current.id, editingItem.value.id, draft, uid)
    else await createItem(current.id, draft, uid)
    itemSheetOpen.value = false
    toast.success(t('itinerary.saved'))
  } catch {
    toast.error(t('common.somethingWrong'))
  }
}

async function removeItem(): Promise<void> {
  const current = group.value
  const item = editingItem.value
  if (!current || !item) return
  const confirmed = await confirm({
    title: t('itinerary.deleteTitle', { name: item.title }),
    message: t('itinerary.deleteMessage'),
    confirmLabel: t('common.delete'),
    tone: 'danger',
  })
  if (!confirmed) return
  try {
    await deleteItem(current.id, item.id)
    itemSheetOpen.value = false
    toast.success(t('itinerary.deleted'))
  } catch {
    toast.error(t('common.somethingWrong'))
  }
}

async function setTripDates(startDate: string, endDate: string): Promise<void> {
  const current = group.value
  if (!current) return
  try {
    await updateGroup(current.id, { startDate, endDate })
    toast.success(t('groups.updated'))
  } catch {
    toast.error(t('common.somethingWrong'))
  }
}

/** The floating button adds whatever the current tab is about. */
function onFab(): void {
  if (tab.value === 'itinerary') openAddItem()
  else openAdd()
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

/** Share the link, or invite someone you have travelled with before. */
const inviteSheetOpen = ref(false)
const aiSheetOpen = ref(false)
function copyInvite(): void {
  inviteSheetOpen.value = true
}
</script>

<template>
  <AppShell>
    <TopBar
      :title="group?.name"
      :subtitle="(group && placeLabel(group.location, group.destination, locale)) || undefined"
      back
    >
      <template v-if="group" #below>
        <nav class="flex gap-1 px-4" role="tablist">
          <button
            v-for="option in TABS"
            :key="option"
            role="tab"
            class="relative flex-1 py-2.5 text-sm font-medium transition-colors"
            :class="tab === option ? 'text-fg' : 'text-muted hover:text-fg'"
            :aria-selected="tab === option"
            @click="tab = option"
          >
            {{ $t(`group.tabs.${option}`) }}
            <span
              v-if="tab === option"
              class="absolute inset-x-6 -bottom-px h-0.5 rounded-full bg-accent"
              aria-hidden="true"
            />
          </button>
        </nav>
      </template>
    </TopBar>

    <div v-if="loading" class="px-5 py-6">
      <AppSkeleton :rows="1" height="h-24" />
      <div class="mt-6"><AppSkeleton :rows="4" height="h-16" /></div>
    </div>

    <template v-else-if="group">
      <GroupStats
        v-if="tab === 'stats'"
        :group="group"
        :entries="entries"
        :itinerary="itinerary"
        :uid="auth.uid ?? ''"
        :locale="locale"
      />

      <GroupTools v-else-if="tab === 'tools'" :group="group" :uid="auth.uid ?? ''" />

      <GroupItinerary
        v-else-if="tab === 'itinerary'"
        :group="group"
        :items="itinerary"
        :locale="locale"
        @add="openAddItem"
        @edit="openEditItem"
        @record="recordItem"
        @set-dates="setTripDates"
        @ai="aiSheetOpen = true"
      />

      <template v-else>
      <section class="px-5 pb-5 pt-6 text-center">
        <p class="text-xs font-medium text-muted">{{ $t('group.total') }}</p>
        <p class="tabular mt-1 text-3xl font-semibold tracking-tight">
          {{ formatNumber(total, group.currency, locale) }}
          <span class="text-base font-normal text-muted">{{ group.currency }}</span>
        </p>
        <!-- A personal trip rarely needs inviting, so it stays a quiet link. -->
        <button
          v-if="!shared"
          class="mt-2 inline-flex items-center gap-1 text-xs text-muted transition-colors hover:text-accent"
          @click="copyInvite"
        >
          <UserPlus class="size-3.5" />
          {{ $t('invite.companion') }}
        </button>
      </section>

      <!-- Labelled actions instead of bare top-bar icons, which people missed. -->
      <section v-if="shared" class="grid grid-cols-2 gap-3 px-5 pb-6">
        <AppButton variant="secondary" @click="copyInvite">
          <template #icon><UserPlus class="size-4" /></template>
          {{ $t('invite.action') }}
        </AppButton>
        <AppButton :variant="settleState === 'pending' ? 'primary' : 'secondary'" @click="settleSheetOpen = true">
          <template #icon>
            <CircleCheck v-if="settleState === 'settled'" class="size-4 text-positive" />
            <HandCoins v-else class="size-4" />
          </template>
          {{ settleLabel }}
        </AppButton>
      </section>

      <section v-if="shared" class="px-5 pb-6">
        <MemberStrip
          :group="group"
          :balances="balances"
          :selected="selectedMember"
          :currency="group.currency"
          :locale="locale"
          @select="selectedMember = $event"
        />
      </section>

      <section class="px-5 pb-28">
        <AppEmptyState
          v-if="!visibleEntries.length"
          :icon="Receipt"
          :title="$t('group.noEntries')"
          :description="$t('group.noEntriesHint')"
        />

        <div v-else class="space-y-5">
          <section v-for="day in entryDays" :key="day.date">
            <header class="mb-2 flex items-baseline justify-between text-xs">
              <h2 class="font-medium text-muted">{{ formatDay(day.date, locale) }}</h2>
              <span v-if="day.subtotal" class="tabular text-faint">
                {{ formatNumber(day.subtotal, group.currency, locale) }} {{ group.currency }}
              </span>
            </header>
            <TransitionGroup name="list" tag="div" class="relative space-y-2.5">
              <EntryRow
                v-for="entry in day.entries"
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
        </div>
      </section>
      </template>

      <button
        v-if="tab !== 'tools'"
        class="fixed bottom-6 right-5 z-30 grid size-13 place-items-center rounded-full bg-accent text-accent-fg shadow-float transition-transform active:scale-95"
        :aria-label="tab === 'itinerary' ? $t('itinerary.addSpot') : $t('group.addExpense')"
        @click="onFab"
      >
        <Plus class="size-6" />
      </button>

      <EntrySheet
        :open="entrySheetOpen"
        :group="group"
        :uid="auth.uid ?? ''"
        :entry="editingEntry"
        :preset-settlement="presetSettlement"
        :preset-expense="presetExpense"
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

      <AiGuideSheet
        :open="aiSheetOpen"
        :group="group"
        :items="itinerary"
        :uid="auth.uid ?? ''"
        :locale="locale"
        @close="aiSheetOpen = false"
      />

      <InviteSheet :open="inviteSheetOpen" :group="group" @close="inviteSheetOpen = false" />

      <ItinerarySheet
        :open="itemSheetOpen"
        :group="group"
        :item="editingItem"
        :preset-date="itemDate"
        :preset-kind="itemKind"
        @close="itemSheetOpen = false"
        @save="saveItem"
        @remove="removeItem"
      />
    </template>
  </AppShell>
</template>
