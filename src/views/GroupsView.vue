<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ChevronDown, MapPin, Plus, RotateCw, Share2, Trash2, Users } from 'lucide-vue-next'
import AppShell from '@/components/layout/AppShell.vue'
import TopBar from '@/components/layout/TopBar.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppEmptyState from '@/components/ui/AppEmptyState.vue'
import AppField from '@/components/ui/AppField.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppSheet from '@/components/ui/AppSheet.vue'
import AppSkeleton from '@/components/ui/AppSkeleton.vue'
import GroupCard from '@/components/group/GroupCard.vue'
import InvitationList from '@/components/group/InvitationList.vue'
import CountryPicker from '@/components/currency/CountryPicker.vue'
import CurrencyPicker from '@/components/currency/CurrencyPicker.vue'
import { countryName } from '@/data/countries'
import { currencyForCountry, currencyName } from '@/data/currencies'
import { detectLocation } from '@/lib/geo'
import { createGroup, deleteGroup, leaveGroup, rotateInviteCode, updateGroup } from '@/services/groups'
import { useAuthStore } from '@/stores/auth'
import { useGroupsStore } from '@/stores/groups'
import { useConfirm } from '@/composables/useConfirm'
import { useInvite } from '@/composables/useInvite'
import { useToast } from '@/composables/useToast'
import type { CurrencyCode } from '@/types/currency'
import type { Group } from '@/types/models'

const { t, locale } = useI18n()
const auth = useAuthStore()
const store = useGroupsStore()
const router = useRouter()
const toast = useToast()
const { invite } = useInvite()
const { confirm } = useConfirm()

watch(
  () => auth.uid,
  (uid) => (uid ? store.subscribe(uid) : store.reset()),
  { immediate: true },
)

const formOpen = ref(false)
const optionsOpen = ref(false)
const pickerOpen = ref(false)
const destinationPickerOpen = ref(false)
const editing = ref<Group | null>(null)
const selected = ref<Group | null>(null)
const detecting = ref(false)
const saving = ref(false)
const formError = ref('')

const form = ref({ name: '', currency: 'USD' as CurrencyCode, destination: '', location: '', startDate: '', endDate: '' })
const isOwner = computed(() => selected.value?.ownerId === auth.uid)

function openCreate(): void {
  editing.value = null
  formError.value = ''
  form.value = {
    name: '',
    currency: auth.profile?.currency ?? 'USD',
    destination: '',
    location: '',
    startDate: '',
    endDate: '',
  }
  formOpen.value = true
}

function openEdit(): void {
  const group = selected.value
  if (!group) return
  editing.value = group
  formError.value = ''
  form.value = {
    name: group.name,
    currency: group.currency,
    destination: group.destination,
    location: group.location,
    startDate: group.startDate,
    endDate: group.endDate,
  }
  optionsOpen.value = false
  formOpen.value = true
}

function openOptions(group: Group): void {
  selected.value = group
  optionsOpen.value = true
}

/**
 * Only a brand-new group adopts the destination's currency; changing it later
 * would invalidate every amount already converted into it.
 */
function setDestination(code: string): void {
  form.value.destination = code
  if (editing.value) return
  const local = currencyForCountry(code)
  if (local) form.value.currency = local
}

function pickDestination(code: string): void {
  setDestination(code)
  destinationPickerOpen.value = false
}

async function detect(): Promise<void> {
  detecting.value = true
  try {
    const result = await detectLocation()
    if (result.countryCode) setDestination(result.countryCode.toUpperCase())
    if (result.city) form.value.location = result.city
  } catch {
    toast.error(t('onboarding.detectFailed'))
  } finally {
    detecting.value = false
  }
}

async function save(): Promise<void> {
  const name = form.value.name.trim()
  if (!name) {
    formError.value = t('groups.nameRequired')
    return
  }

  // Both trip dates or neither; a lone date cannot lay out an itinerary.
  const { startDate, endDate } = form.value
  if ((startDate || endDate) && !(startDate && endDate && startDate <= endDate)) {
    formError.value = t('itinerary.datesInvalid')
    return
  }

  const profile = auth.profile
  if (!profile) return

  saving.value = true
  try {
    if (editing.value) {
      await updateGroup(editing.value.id, {
        name,
        destination: form.value.destination,
        location: form.value.location.trim(),
        startDate,
        endDate,
      })
      toast.success(t('groups.updated'))
    } else {
      await createGroup({
        name,
        currency: form.value.currency,
        destination: form.value.destination,
        location: form.value.location.trim(),
        startDate,
        endDate,
        owner: {
          uid: profile.uid,
          member: { nickname: profile.nickname, payment: profile.payment },
        },
      })
      toast.success(t('groups.created'))
    }
    formOpen.value = false
  } catch {
    toast.error(t('common.somethingWrong'))
  } finally {
    saving.value = false
  }
}

function copyInvite(): void {
  const group = selected.value
  if (!group) return
  void invite(group)
  optionsOpen.value = false
}

async function rotateInvite(): Promise<void> {
  const group = selected.value
  if (!group) return

  try {
    await rotateInviteCode(group.id)
    toast.success(t('invite.rotated'))
  } catch {
    toast.error(t('common.somethingWrong'))
  }
  optionsOpen.value = false
}

async function remove(): Promise<void> {
  const group = selected.value
  if (!group) return

  const confirmed = await confirm({
    title: t('groups.deleteTitle', { name: group.name }),
    message: t('groups.deleteMessage'),
    confirmLabel: t('common.delete'),
    tone: 'danger',
  })
  if (!confirmed) return

  try {
    await deleteGroup(group.id)
    toast.success(t('groups.deleted'))
  } catch {
    toast.error(t('common.somethingWrong'))
  }
  optionsOpen.value = false
}

async function leave(): Promise<void> {
  const group = selected.value
  const uid = auth.uid
  if (!group || !uid) return

  const confirmed = await confirm({
    title: t('groups.leaveTitle', { name: group.name }),
    message: t('groups.leaveMessage'),
    confirmLabel: t('groups.leaveAction'),
    tone: 'danger',
  })
  if (!confirmed) return

  try {
    await leaveGroup(group.id, uid)
    toast.success(t('groups.left'))
  } catch {
    toast.error(t('common.somethingWrong'))
  }
  optionsOpen.value = false
}
</script>

<template>
  <AppShell nav>
    <TopBar :title="t('groups.title')" />

    <div class="px-5 py-5">
      <InvitationList />
      <AppSkeleton v-if="store.loading" :rows="3" />

      <AppEmptyState
        v-else-if="!store.active.length"
        :icon="Users"
        :title="t('groups.empty')"
        :description="t('groups.emptyHint')"
      >
        <AppButton @click="openCreate">
          <template #icon><Plus class="size-4" /></template>
          {{ t('groups.create') }}
        </AppButton>
      </AppEmptyState>

      <TransitionGroup v-else name="list" tag="div" class="relative space-y-3">
        <GroupCard
          v-for="group in store.active"
          :key="group.id"
          :group="group"
          @open="router.push({ name: 'group', params: { id: group.id } })"
          @options="openOptions(group)"
        />
      </TransitionGroup>
    </div>

    <button
      v-if="store.active.length"
      class="fixed bottom-24 right-5 z-30 grid size-13 place-items-center rounded-full bg-accent text-accent-fg shadow-float transition-transform active:scale-95"
      :aria-label="t('groups.create')"
      @click="openCreate"
    >
      <Plus class="size-6" />
    </button>

    <AppSheet
      :open="formOpen"
      :title="editing ? t('groups.editGroup') : t('groups.newGroup')"
      @close="formOpen = false"
    >
      <div class="space-y-6">
        <AppField :label="t('groups.name')" for="group-name">
          <AppInput id="group-name" v-model="form.name" :placeholder="t('groups.namePlaceholder')" />
          <p v-if="formError" class="text-xs text-negative">{{ formError }}</p>
        </AppField>

        <AppField :label="t('groups.destination')">
          <div class="flex gap-2">
            <button
              type="button"
              class="flex h-11 min-w-0 flex-1 items-center justify-between rounded-xl border border-border bg-surface px-3.5 text-sm transition-colors hover:border-border-strong"
              @click="destinationPickerOpen = true"
            >
              <span class="truncate" :class="form.destination ? 'font-medium' : 'text-faint'">
                {{ form.destination ? countryName(form.destination, locale) : t('onboarding.countryPlaceholder') }}
              </span>
              <ChevronDown class="size-4 shrink-0 text-muted" />
            </button>
            <AppButton variant="secondary" :loading="detecting" @click="detect">
              <template #icon><MapPin class="size-4" /></template>
              <span class="sr-only">{{ t('onboarding.detect') }}</span>
            </AppButton>
          </div>
        </AppField>

        <AppField
          :label="t('common.currency')"
          :hint="editing ? t('groups.currencyLocked') : t('groups.currencyFollowsDestination')"
        >
          <button
            type="button"
            class="flex h-11 w-full items-center justify-between rounded-xl border border-border bg-surface px-3.5 text-sm transition-colors disabled:opacity-50"
            :disabled="!!editing"
            @click="pickerOpen = true"
          >
            <span class="font-medium">{{ form.currency }}</span>
            <span class="truncate pl-3 text-xs text-muted">{{ currencyName(form.currency) }}</span>
          </button>
        </AppField>

        <AppField :label="t('groups.city')" for="group-location">
          <AppInput
            id="group-location"
            v-model="form.location"
            :placeholder="t('groups.locationPlaceholder')"
          />
        </AppField>

        <AppField :label="t('groups.tripDates')" :hint="t('groups.tripDatesHint')">
          <div class="grid grid-cols-2 gap-3">
            <input
              v-model="form.startDate"
              type="date"
              :aria-label="t('itinerary.startDate')"
              class="tabular h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm focus:border-accent focus:outline-none"
            />
            <input
              v-model="form.endDate"
              type="date"
              :min="form.startDate || undefined"
              :aria-label="t('itinerary.endDate')"
              class="tabular h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm focus:border-accent focus:outline-none"
            />
          </div>
        </AppField>
      </div>

      <template #footer>
        <div class="grid grid-cols-2 gap-3">
          <AppButton variant="secondary" @click="formOpen = false">{{ t('common.cancel') }}</AppButton>
          <AppButton :loading="saving" @click="save">
            {{ editing ? t('common.update') : t('common.create') }}
          </AppButton>
        </div>
      </template>
    </AppSheet>

    <AppSheet :open="optionsOpen" :title="selected?.name" @close="optionsOpen = false">
      <p v-if="!isOwner && selected" class="mb-4 text-xs text-muted">
        {{ t('groups.ownedBy', { name: selected.members[selected.ownerId]?.nickname ?? t('common.unknown') }) }}
      </p>

      <div class="space-y-2">
        <button
          class="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors hover:bg-surface-2"
          @click="copyInvite"
        >
          <Share2 class="size-4 text-muted" />
          {{ t('invite.copy') }}
        </button>

        <template v-if="isOwner">
          <button
            class="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors hover:bg-surface-2"
            @click="openEdit"
          >
            <MapPin class="size-4 text-muted" />
            {{ t('groups.editGroup') }}
          </button>

          <button
            class="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors hover:bg-surface-2"
            @click="rotateInvite"
          >
            <RotateCw class="size-4 text-muted" />
            {{ t('invite.rotate') }}
          </button>

          <button
            class="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-negative transition-colors hover:bg-negative-soft"
            @click="remove"
          >
            <Trash2 class="size-4" />
            {{ t('common.delete') }}
          </button>
        </template>

        <button
          v-else
          class="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-negative transition-colors hover:bg-negative-soft"
          @click="leave"
        >
          <Trash2 class="size-4" />
          {{ t('groups.leaveAction') }}
        </button>
      </div>
    </AppSheet>

    <CurrencyPicker
      :open="pickerOpen"
      :title="t('common.currency')"
      :selected="form.currency"
      @close="pickerOpen = false"
      @select="form.currency = $event; pickerOpen = false"
    />

    <CountryPicker
      :open="destinationPickerOpen"
      :title="t('groups.destination')"
      :selected="form.destination"
      @close="destinationPickerOpen = false"
      @select="pickDestination"
    />
  </AppShell>
</template>
